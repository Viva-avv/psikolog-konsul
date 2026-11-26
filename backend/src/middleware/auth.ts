import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@prisma/client';
import { verifyAccessToken } from '../lib/jwt';
import { prisma } from '../lib/prisma';
import { forbidden, unauthorized } from '../lib/errors';

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next(unauthorized());

  let payload;
  try {
    payload = verifyAccessToken(header.slice(7));
  } catch {
    return next(unauthorized('Token tidak valid atau kedaluwarsa'));
  }

  // Re-check status so suspensions/role changes take effect before token expiry.
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, role: true, status: true },
  });
  if (!user || user.status !== 'ACTIVE') return next(unauthorized('Akun tidak aktif'));

  req.user = { id: user.id, role: user.role };
  next();
}

export const requireRole =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden());
    next();
  };
