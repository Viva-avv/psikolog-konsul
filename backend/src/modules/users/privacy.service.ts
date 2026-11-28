import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import type { Request } from 'express';
import { prisma } from '../../lib/prisma';
import { audit } from '../../lib/audit';
import { decrypt, decryptJson } from '../../lib/crypto';
import { unauthorized } from '../../lib/errors';

/** UU PDP right of access: everything stored about the user, decrypted, in one JSON document. */
export async function exportData(req: Request, userId: string) {
  const [user, consents, bookings, assessments, summaries, selfTests, conversations, sentMessages] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true, fullName: true, role: true, createdAt: true },
    }),
    prisma.consent.findMany({
      where: { userId },
      select: { type: true, scopeRef: true, policyVersion: true, grantedAt: true, revokedAt: true },
    }),
    prisma.booking.findMany({
      where: { userId },
      select: {
        id: true,
        status: true,
        mode: true,
        price: true,
        createdAt: true,
        slot: { select: { startAt: true, endAt: true } },
        psychologist: { select: { user: { select: { fullName: true } } } },
        payment: { select: { status: true, amount: true, paidAt: true } },
      },
    }),
    prisma.assessment.findMany({ where: { userId } }),
    prisma.assessmentSummary.findMany({ where: { userId } }),
    prisma.selfTestResult.findMany({ where: { userId } }),
    prisma.aiConversation.findMany({ where: { userId }, include: { messages: { orderBy: { createdAt: 'asc' } } } }),
    prisma.chatMessage.findMany({ where: { senderId: userId }, orderBy: { createdAt: 'asc' } }),
  ]);

  await audit(req, { action: 'user.export', entityType: 'User', entityId: userId });

  return {
    exportedAt: new Date().toISOString(),
    user,
    consents,
    bookings: bookings.map((b) => ({
      id: b.id,
      status: b.status,
      mode: b.mode,
      price: b.price,
      createdAt: b.createdAt,
      startAt: b.slot.startAt,
      endAt: b.slot.endAt,
      psychologist: b.psychologist.user.fullName,
      payment: b.payment,
    })),
    assessments: assessments.map((a) => ({ type: a.type, createdAt: a.createdAt, ...decryptJson<object>(a.resultEnc) })),
    assessmentSummaries: summaries.map((s) => ({ createdAt: s.createdAt, ...decryptJson<object>(s.contentEnc) })),
    selfTestResults: selfTests.map((r) => ({ type: r.type, createdAt: r.createdAt, ...decryptJson<object>(r.resultEnc) })),
    aiConversations: conversations.map((c) => ({
      id: c.id,
      status: c.status,
      createdAt: c.createdAt,
      messages: c.messages.map((m) => ({ role: m.role, content: decrypt(m.contentEnc), createdAt: m.createdAt })),
    })),
    sessionMessagesSent: sentMessages.map((m) => ({
      bookingId: m.bookingId,
      content: decrypt(m.contentEnc),
      createdAt: m.createdAt,
    })),
  };
}

/**
 * UU PDP right to erasure. Personal and health data are deleted; booking/payment records are kept
 * (anonymised) for financial record-keeping obligations.
 */
export async function deleteAccount(req: Request, userId: string, password: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await bcrypt.compare(password, user.passwordHash))) throw unauthorized('Password salah');

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const request = await tx.dataDeletionRequest.create({ data: { userId } });

    const upcoming = await tx.booking.findMany({
      where: { userId, status: { in: ['PENDING_PAYMENT', 'CONFIRMED'] }, slot: { startAt: { gt: now } } },
      select: { id: true, slotId: true },
    });
    for (const b of upcoming) {
      await tx.booking.update({ where: { id: b.id }, data: { status: 'CANCELLED', holdExpiresAt: null, sharedSummaryId: null } });
      await tx.availabilitySlot.update({ where: { id: b.slotId }, data: { status: 'AVAILABLE' } });
      await tx.payment.updateMany({ where: { bookingId: b.id, status: 'SETTLED' }, data: { refundRequired: true } });
      await tx.payment.updateMany({ where: { bookingId: b.id, status: 'PENDING' }, data: { status: 'FAILED' } });
    }

    await tx.aiConversation.deleteMany({ where: { userId } });
    await tx.assessmentSummary.deleteMany({ where: { userId } });
    await tx.assessment.deleteMany({ where: { userId } });
    await tx.selfTestResult.deleteMany({ where: { userId } });
    await tx.chatMessage.deleteMany({ where: { senderId: userId } });
    await tx.refreshToken.deleteMany({ where: { userId } });
    await tx.consent.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
    await tx.crisisIncident.updateMany({ where: { userId }, data: { userId: null } });

    await tx.user.update({
      where: { id: userId },
      data: {
        email: `deleted+${userId}@deleted.invalid`,
        fullName: 'Pengguna terhapus',
        passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 4),
        status: 'DELETED',
        deletedAt: now,
      },
    });
    await tx.dataDeletionRequest.update({ where: { id: request.id }, data: { status: 'COMPLETED', completedAt: now } });
  });

  await audit(req, { action: 'user.delete_account', actorId: userId, entityType: 'User', entityId: userId });
}
