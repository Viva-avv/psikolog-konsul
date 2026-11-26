import type { Role } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { decrypt, encrypt } from '../../lib/crypto';
import { badRequest, forbidden } from '../../lib/errors';
import { sanitizeInput } from '../ai/guard';
import { findAccessible, type Viewer } from '../bookings/bookings.service';
import { isSessionOpen } from '../bookings/bookings.schema';

const HISTORY_LIMIT = 200;

export interface SessionMessage {
  id: string;
  senderRole: Role | null;
  mine: boolean;
  content: string;
  createdAt: Date;
}

/** Participant + status check shared by REST history and socket join. */
export async function requireChatAccess(viewer: Viewer, bookingId: string) {
  const b = await findAccessible(viewer, bookingId);
  if (!['CONFIRMED', 'COMPLETED'].includes(b.status)) throw forbidden('Ruang sesi belum tersedia');
  return b;
}

export async function history(viewer: Viewer, bookingId: string): Promise<SessionMessage[]> {
  await requireChatAccess(viewer, bookingId);
  const rows = await prisma.chatMessage.findMany({
    where: { bookingId },
    include: { sender: { select: { role: true } } },
    orderBy: { createdAt: 'desc' },
    take: HISTORY_LIMIT,
  });
  return rows.reverse().map((m) => ({
    id: m.id,
    senderRole: m.sender?.role ?? null,
    mine: m.senderId === viewer.id,
    content: decrypt(m.contentEnc),
    createdAt: m.createdAt,
  }));
}

export async function postMessage(viewer: Viewer, bookingId: string, raw: string) {
  const b = await requireChatAccess(viewer, bookingId);
  if (b.status !== 'CONFIRMED' || !isSessionOpen(b.slot.startAt, b.slot.endAt)) {
    throw forbidden('Chat hanya dapat digunakan selama jadwal sesi');
  }
  const content = sanitizeInput(raw);
  if (!content) throw badRequest('Pesan kosong');

  const saved = await prisma.chatMessage.create({
    data: { bookingId, senderId: viewer.id, contentEnc: encrypt(content) },
  });
  return { id: saved.id, senderRole: viewer.role, content, createdAt: saved.createdAt };
}
