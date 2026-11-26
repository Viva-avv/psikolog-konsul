import type { Request } from 'express';
import type { Prisma, Role } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { audit } from '../../lib/audit';
import { decrypt, decryptJson, encrypt } from '../../lib/crypto';
import { badRequest, conflict, notFound } from '../../lib/errors';
import { requireOwnProfile } from '../psychologists/psychologists.service';
import { hasConsent } from '../consents/consents.service';
import { getOwnSummary, type SummaryContent } from '../ai/assessment/assessment.service';
import {
  BOOKING_MIN_LEAD_MINUTES,
  MAX_PENDING_BOOKINGS_PER_USER,
  PAYMENT_HOLD_MINUTES,
  USER_CANCEL_MIN_HOURS,
  sessionWindow,
  type BookingListQuery,
  type CreateBookingInput,
} from './bookings.schema';

const bookingInclude = {
  slot: { select: { startAt: true, endAt: true } },
  psychologist: { select: { id: true, userId: true, title: true, user: { select: { fullName: true } } } },
  user: { select: { fullName: true } },
  payment: { select: { status: true, refundRequired: true } },
} satisfies Prisma.BookingInclude;

type BookingRow = Prisma.BookingGetPayload<{ include: typeof bookingInclude }>;
export type Viewer = { id: string; role: Role };

function toView(b: BookingRow, viewerRole: Role) {
  const { opensAt, closesAt } = sessionWindow(b.slot.startAt, b.slot.endAt);
  return {
    id: b.id,
    mode: b.mode,
    status: b.status,
    price: b.price,
    startAt: b.slot.startAt,
    endAt: b.slot.endAt,
    sessionOpensAt: opensAt,
    sessionClosesAt: closesAt,
    holdExpiresAt: b.holdExpiresAt,
    createdAt: b.createdAt,
    payment: b.payment,
    hasSharedSummary: Boolean(b.sharedSummaryId),
    psychologist: { id: b.psychologist.id, fullName: b.psychologist.user.fullName, title: b.psychologist.title },
    // Psychologists only see the client's name (data minimization).
    client: viewerRole === 'PSYCHOLOGIST' ? { fullName: b.user.fullName } : undefined,
  };
}

/** Returns the booking only if the viewer is its client or psychologist; otherwise 404 to avoid leaking existence. */
export async function findAccessible(viewer: Viewer, id: string) {
  const b = await prisma.booking.findUnique({ where: { id }, include: bookingInclude });
  const allowed =
    b &&
    ((viewer.role === 'USER' && b.userId === viewer.id) ||
      (viewer.role === 'PSYCHOLOGIST' && b.psychologist.userId === viewer.id));
  if (!allowed) throw notFound('Booking tidak ditemukan');
  return b;
}

export async function expireStaleHolds() {
  const stale = await prisma.booking.findMany({
    where: { status: 'PENDING_PAYMENT', holdExpiresAt: { lt: new Date() } },
    select: { id: true, slotId: true },
    take: 100,
  });
  for (const b of stale) {
    await prisma.$transaction(async (tx) => {
      const { count } = await tx.booking.updateMany({
        where: { id: b.id, status: 'PENDING_PAYMENT' },
        data: { status: 'EXPIRED' },
      });
      if (count) {
        await tx.availabilitySlot.updateMany({ where: { id: b.slotId, status: 'HELD' }, data: { status: 'AVAILABLE' } });
        await tx.payment.updateMany({ where: { bookingId: b.id, status: 'PENDING' }, data: { status: 'EXPIRED' } });
      }
    });
  }
  return stale.length;
}

export async function create(req: Request, userId: string, input: CreateBookingInput) {
  await expireStaleHolds();

  const pending = await prisma.booking.count({ where: { userId, status: 'PENDING_PAYMENT' } });
  if (pending >= MAX_PENDING_BOOKINGS_PER_USER) {
    throw conflict('Selesaikan atau batalkan booking yang menunggu pembayaran terlebih dahulu');
  }

  const slot = await prisma.availabilitySlot.findUnique({
    where: { id: input.slotId },
    include: {
      psychologist: { select: { id: true, pricePerSession: true, verificationStatus: true, user: { select: { status: true } } } },
    },
  });
  if (!slot || slot.psychologist.verificationStatus !== 'VERIFIED' || slot.psychologist.user.status !== 'ACTIVE') {
    throw notFound('Slot tidak ditemukan');
  }
  if (slot.startAt.getTime() < Date.now() + BOOKING_MIN_LEAD_MINUTES * 60_000) {
    throw badRequest(`Booking minimal ${BOOKING_MIN_LEAD_MINUTES} menit sebelum sesi dimulai`);
  }

  const price = slot.psychologist.pricePerSession;
  const isFree = price === 0;

  const booking = await prisma.$transaction(async (tx) => {
    // Conditional update makes slot reservation atomic under concurrent requests.
    const { count } = await tx.availabilitySlot.updateMany({
      where: { id: slot.id, status: 'AVAILABLE' },
      data: { status: isFree ? 'BOOKED' : 'HELD' },
    });
    if (!count) throw conflict('Slot sudah tidak tersedia');
    return tx.booking.create({
      data: {
        userId,
        psychologistId: slot.psychologist.id,
        slotId: slot.id,
        mode: input.mode,
        price,
        status: isFree ? 'CONFIRMED' : 'PENDING_PAYMENT',
        holdExpiresAt: isFree ? null : new Date(Date.now() + PAYMENT_HOLD_MINUTES * 60_000),
      },
      include: bookingInclude,
    });
  });

  await audit(req, { action: 'booking.create', entityType: 'Booking', entityId: booking.id });
  return toView(booking, 'USER');
}

function paginate(q: BookingListQuery) {
  return { skip: (q.page - 1) * q.pageSize, take: q.pageSize };
}

export async function listForUser(userId: string, q: BookingListQuery) {
  const where: Prisma.BookingWhereInput = { userId, ...(q.status && { status: q.status }) };
  const [rows, total] = await prisma.$transaction([
    prisma.booking.findMany({ where, include: bookingInclude, orderBy: { slot: { startAt: 'desc' } }, ...paginate(q) }),
    prisma.booking.count({ where }),
  ]);
  return { items: rows.map((b) => toView(b, 'USER')), total, page: q.page, pageSize: q.pageSize };
}

export async function listForPsychologist(userId: string, q: BookingListQuery) {
  const profile = await requireOwnProfile(userId);
  const where: Prisma.BookingWhereInput = {
    psychologistId: profile.id,
    status: q.status ?? { in: ['CONFIRMED', 'COMPLETED', 'CANCELLED'] },
  };
  const [rows, total] = await prisma.$transaction([
    prisma.booking.findMany({ where, include: bookingInclude, orderBy: { slot: { startAt: 'asc' } }, ...paginate(q) }),
    prisma.booking.count({ where }),
  ]);
  return { items: rows.map((b) => toView(b, 'PSYCHOLOGIST')), total, page: q.page, pageSize: q.pageSize };
}

export async function getForViewer(viewer: Viewer, id: string) {
  return toView(await findAccessible(viewer, id), viewer.role);
}

export async function cancel(req: Request, id: string) {
  const viewer = req.user!;
  const b = await findAccessible(viewer, id);
  const msUntilStart = b.slot.startAt.getTime() - Date.now();
  const isClient = viewer.role === 'USER';

  if (isClient) {
    const canCancel =
      b.status === 'PENDING_PAYMENT' ||
      (b.status === 'CONFIRMED' && msUntilStart >= USER_CANCEL_MIN_HOURS * 3_600_000);
    if (!canCancel) {
      throw badRequest(`Pembatalan hanya bisa dilakukan paling lambat ${USER_CANCEL_MIN_HOURS} jam sebelum sesi`);
    }
  } else if (!['PENDING_PAYMENT', 'CONFIRMED'].includes(b.status) || msUntilStart <= 0) {
    throw badRequest('Booking ini tidak bisa dibatalkan');
  }

  await prisma.$transaction(async (tx) => {
    const { count } = await tx.booking.updateMany({
      where: { id: b.id, status: b.status },
      data: { status: 'CANCELLED', holdExpiresAt: null },
    });
    if (!count) throw conflict('Status booking sudah berubah, muat ulang halaman');
    // Slot is released when the client cancels, blocked when the psychologist cancels.
    await tx.availabilitySlot.update({
      where: { id: b.slotId },
      data: { status: isClient ? 'AVAILABLE' : 'BLOCKED' },
    });
    await tx.payment.updateMany({ where: { bookingId: b.id, status: 'SETTLED' }, data: { refundRequired: true } });
    await tx.payment.updateMany({ where: { bookingId: b.id, status: 'PENDING' }, data: { status: 'FAILED' } });
  });
  await audit(req, { action: 'booking.cancel', entityType: 'Booking', entityId: b.id, metadata: { by: viewer.role } });
  return getForViewer(viewer, id);
}

export async function complete(req: Request, id: string) {
  const b = await findAccessible(req.user!, id);
  if (b.status !== 'CONFIRMED') throw badRequest('Hanya booking terkonfirmasi yang bisa diselesaikan');
  if (b.slot.startAt.getTime() > Date.now()) throw badRequest('Sesi belum dimulai');

  const { count } = await prisma.booking.updateMany({
    where: { id: b.id, status: 'CONFIRMED' },
    data: { status: 'COMPLETED' },
  });
  if (!count) throw conflict('Status booking sudah berubah');
  await audit(req, { action: 'booking.complete', entityType: 'Booking', entityId: b.id });
  return getForViewer(req.user!, id);
}

async function requireNoteAccess(req: Request, bookingId: string) {
  const b = await findAccessible(req.user!, bookingId);
  if (!['CONFIRMED', 'COMPLETED'].includes(b.status)) throw badRequest('Catatan hanya untuk sesi terkonfirmasi');
  return b;
}

export async function getNote(req: Request, bookingId: string) {
  const b = await requireNoteAccess(req, bookingId);
  const note = await prisma.sessionNote.findUnique({
    where: { bookingId_psychologistId: { bookingId: b.id, psychologistId: b.psychologistId } },
  });
  await audit(req, { action: 'note.read', entityType: 'Booking', entityId: b.id });
  return note ? { content: decrypt(note.contentEnc), updatedAt: note.updatedAt } : null;
}

export async function saveNote(req: Request, bookingId: string, content: string) {
  const b = await requireNoteAccess(req, bookingId);
  const note = await prisma.sessionNote.upsert({
    where: { bookingId_psychologistId: { bookingId: b.id, psychologistId: b.psychologistId } },
    create: { bookingId: b.id, psychologistId: b.psychologistId, contentEnc: encrypt(content) },
    update: { contentEnc: encrypt(content) },
  });
  await audit(req, { action: 'note.update', entityType: 'Booking', entityId: b.id });
  return { content, updatedAt: note.updatedAt };
}

// ---------- Pre-assessment sharing (explicit, per-booking consent) ----------

export async function shareSummary(req: Request, bookingId: string, summaryId: string) {
  const viewer = req.user!;
  const b = await findAccessible(viewer, bookingId);
  if (!['PENDING_PAYMENT', 'CONFIRMED'].includes(b.status)) throw badRequest('Booking ini tidak aktif');
  await getOwnSummary(viewer.id, summaryId);

  await prisma.$transaction([
    prisma.consent.updateMany({
      where: { userId: viewer.id, type: 'SHARE_ASSESSMENT', scopeRef: b.id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    prisma.consent.create({
      data: { userId: viewer.id, type: 'SHARE_ASSESSMENT', scopeRef: b.id, policyVersion: env.POLICY_VERSION },
    }),
    prisma.booking.update({ where: { id: b.id }, data: { sharedSummaryId: summaryId } }),
  ]);
  await audit(req, { action: 'summary.share', entityType: 'Booking', entityId: b.id });
  return getForViewer(viewer, bookingId);
}

export async function unshareSummary(req: Request, bookingId: string) {
  const viewer = req.user!;
  const b = await findAccessible(viewer, bookingId);
  await prisma.$transaction([
    prisma.consent.updateMany({
      where: { userId: viewer.id, type: 'SHARE_ASSESSMENT', scopeRef: b.id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    prisma.booking.update({ where: { id: b.id }, data: { sharedSummaryId: null } }),
  ]);
  await audit(req, { action: 'summary.unshare', entityType: 'Booking', entityId: b.id });
  return getForViewer(viewer, bookingId);
}

export async function getSharedSummary(req: Request, bookingId: string) {
  const viewer = req.user!;
  const b = await findAccessible(viewer, bookingId);
  const notShared = notFound('Klien tidak membagikan ringkasan pra-asesmen');
  if (!b.sharedSummaryId || !(await hasConsent(b.userId, 'SHARE_ASSESSMENT', b.id))) throw notShared;
  if (viewer.role === 'PSYCHOLOGIST' && !['CONFIRMED', 'COMPLETED'].includes(b.status)) throw notShared;

  const row = await prisma.assessmentSummary.findUnique({ where: { id: b.sharedSummaryId } });
  if (!row) throw notShared;
  if (viewer.role === 'PSYCHOLOGIST') {
    await audit(req, { action: 'summary.read', entityType: 'AssessmentSummary', entityId: row.id });
  }
  return { id: row.id, createdAt: row.createdAt, ...decryptJson<SummaryContent>(row.contentEnc) };
}
