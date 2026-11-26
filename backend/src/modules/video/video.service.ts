import crypto from 'crypto';
import type { Request } from 'express';
import { prisma } from '../../lib/prisma';
import { audit } from '../../lib/audit';
import { badRequest, forbidden } from '../../lib/errors';
import { createMeetingToken, createRoom } from '../../lib/daily';
import { findAccessible } from '../bookings/bookings.service';
import { isSessionOpen, sessionWindow } from '../bookings/bookings.schema';

export async function joinVideo(req: Request, bookingId: string) {
  const viewer = req.user!;
  const b = await findAccessible(viewer, bookingId);
  if (b.mode !== 'VIDEO') throw badRequest('Sesi ini menggunakan mode chat');
  if (b.status !== 'CONFIRMED') throw forbidden('Sesi belum terkonfirmasi');
  if (!isSessionOpen(b.slot.startAt, b.slot.endAt)) throw forbidden('Ruang video hanya dibuka sesuai jadwal sesi');

  const { opensAt, closesAt } = sessionWindow(b.slot.startAt, b.slot.endAt);
  let roomUrl = b.videoRoomUrl;
  if (!roomUrl) {
    // Unguessable name; the room is private and also requires a meeting token.
    const room = await createRoom(`s-${crypto.randomBytes(12).toString('hex')}`, opensAt, closesAt);
    const { count } = await prisma.booking.updateMany({
      where: { id: b.id, videoRoomUrl: null },
      data: { videoRoomUrl: room.url },
    });
    roomUrl = count
      ? room.url
      : (await prisma.booking.findUniqueOrThrow({ where: { id: b.id }, select: { videoRoomUrl: true } })).videoRoomUrl!;
  }

  const roomName = new URL(roomUrl).pathname.slice(1);
  const isPsychologist = viewer.role === 'PSYCHOLOGIST';
  const displayName = isPsychologist ? b.psychologist.user.fullName : b.user.fullName;
  const token = await createMeetingToken(roomName, displayName, closesAt, isPsychologist);
  await audit(req, { action: 'video.join', entityType: 'Booking', entityId: b.id });

  return { url: roomUrl, token };
}
