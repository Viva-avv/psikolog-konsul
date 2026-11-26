import bcrypt from 'bcryptjs';
import type { Request } from 'express';
import type { User } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { signAccessToken } from '../../lib/jwt';
import { randomToken, sha256 } from '../../lib/crypto';
import { conflict, unauthorized } from '../../lib/errors';
import { audit } from '../../lib/audit';
import { getProfile } from '../users/users.service';
import type { LoginInput, RegisterInput } from './auth.schema';

const BCRYPT_COST = 12;
// Used to keep login timing constant when the email does not exist.
const DUMMY_HASH = bcrypt.hashSync('timing-equalizer-password', BCRYPT_COST);
// Concurrent refreshes (multi-tab) within this window are rejected without revoking the whole family.
const REUSE_GRACE_MS = 30_000;

async function issueTokens(user: Pick<User, 'id' | 'role'>) {
  const refreshToken = randomToken();
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: sha256(refreshToken),
      expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000),
    },
  });
  return { accessToken: signAccessToken({ sub: user.id, role: user.role }), refreshToken };
}

export async function register(req: Request, input: RegisterInput) {
  const exists = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (exists) throw conflict('Email sudah terdaftar');

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: input.email,
        passwordHash: await bcrypt.hash(input.password, BCRYPT_COST),
        fullName: input.fullName,
        role: input.role,
      },
    });
    await tx.consent.create({
      data: { userId: created.id, type: 'TERMS_PRIVACY', policyVersion: env.POLICY_VERSION },
    });
    if (input.role === 'PSYCHOLOGIST') {
      await tx.psychologistProfile.create({ data: { userId: created.id } });
    }
    return created;
  });

  await audit(req, { action: 'auth.register', actorId: user.id, entityType: 'User', entityId: user.id });
  const tokens = await issueTokens(user);
  return { ...tokens, user: await getProfile(user.id) };
}

export async function login(req: Request, input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  const valid = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !valid) {
    await audit(req, { action: 'auth.login_failed', actorId: user?.id ?? null });
    throw unauthorized('Email atau password salah');
  }
  if (user.status !== 'ACTIVE') throw unauthorized('Akun tidak aktif');

  await audit(req, { action: 'auth.login', actorId: user.id });
  const tokens = await issueTokens(user);
  return { ...tokens, user: await getProfile(user.id) };
}

export async function refresh(req: Request, rawToken: string | undefined) {
  if (!rawToken) throw unauthorized();

  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash: sha256(rawToken) },
    include: { user: { select: { id: true, role: true, status: true } } },
  });
  if (!record) throw unauthorized();

  if (record.revokedAt) {
    if (Date.now() - record.revokedAt.getTime() > REUSE_GRACE_MS) {
      await prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await audit(req, { action: 'auth.refresh_reuse_detected', actorId: record.userId });
    }
    throw unauthorized();
  }
  if (record.expiresAt < new Date() || record.user.status !== 'ACTIVE') throw unauthorized();

  // Conditional update guards against two requests rotating the same token.
  const { count } = await prisma.refreshToken.updateMany({
    where: { id: record.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (count !== 1) throw unauthorized();

  const tokens = await issueTokens(record.user);
  return { ...tokens, user: await getProfile(record.user.id) };
}

export async function logout(req: Request, rawToken: string | undefined) {
  if (!rawToken) return;
  const { count } = await prisma.refreshToken.updateMany({
    where: { tokenHash: sha256(rawToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (count) await audit(req, { action: 'auth.logout' });
}
