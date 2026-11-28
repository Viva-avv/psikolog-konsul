import type { Request } from 'express';
import type { ConsentType, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { audit } from '../../lib/audit';
import { AppError } from '../../lib/errors';

export const USER_MANAGED_CONSENTS = ['AI_PROCESSING', 'STORE_AI_CHAT', 'STORE_ASSESSMENT'] as const;
export type UserManagedConsent = (typeof USER_MANAGED_CONSENTS)[number];

export async function hasConsent(userId: string, type: ConsentType, scopeRef?: string) {
  const found = await prisma.consent.findFirst({
    where: { userId, type, revokedAt: null, ...(scopeRef !== undefined && { scopeRef }) },
    select: { id: true },
  });
  return Boolean(found);
}

export async function requireConsent(userId: string, type: ConsentType) {
  if (!(await hasConsent(userId, type))) {
    throw new AppError(403, 'CONSENT_REQUIRED', `Persetujuan ${type} diperlukan untuk fitur ini`);
  }
}

export function listActive(userId: string) {
  return prisma.consent.findMany({
    where: { userId, revokedAt: null },
    select: { id: true, type: true, scopeRef: true, policyVersion: true, grantedAt: true },
    orderBy: { grantedAt: 'desc' },
  });
}

export async function grant(req: Request, userId: string, type: UserManagedConsent) {
  const existing = await prisma.consent.findFirst({ where: { userId, type, revokedAt: null, scopeRef: null } });
  if (existing) return existing;
  const consent = await prisma.consent.create({ data: { userId, type, policyVersion: env.POLICY_VERSION } });
  await audit(req, { action: 'consent.grant', entityType: 'Consent', entityId: consent.id, metadata: { type } });
  return consent;
}

/** Revoking a storage consent also erases the data it covered. */
export async function revoke(req: Request, userId: string, type: UserManagedConsent) {
  const now = new Date();
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.consent.updateMany({ where: { userId, type, revokedAt: null }, data: { revokedAt: now } });

    if (type === 'STORE_AI_CHAT') {
      await tx.aiConversation.deleteMany({ where: { userId } });
    }
    if (type === 'STORE_ASSESSMENT') {
      await tx.consent.updateMany({
        where: { userId, type: 'SHARE_ASSESSMENT', revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.assessmentSummary.deleteMany({ where: { userId } });
      await tx.assessment.deleteMany({ where: { userId } });
      await tx.selfTestResult.deleteMany({ where: { userId } });
    }
  });
  await audit(req, { action: 'consent.revoke', metadata: { type } });
}
