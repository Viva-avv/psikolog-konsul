import type { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { prisma } from '../../lib/prisma';
import { decrypt, encrypt } from '../../lib/crypto';
import { audit } from '../../lib/audit';
import { saveFile } from '../../lib/storage';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors';
import { BOOKING_MIN_LEAD_MINUTES } from '../bookings/bookings.schema';
import type { CreateSlotsInput, DocumentInput, ProfileInput } from './psychologists.schema';

const MAX_SLOT_RANGE_DAYS = 31;

export const publicSelect = {
  id: true,
  title: true,
  bio: true,
  yearsExperience: true,
  pricePerSession: true,
  user: { select: { fullName: true } },
  specializations: { select: { specialization: { select: { id: true, slug: true, name: true } } } },
} satisfies Prisma.PsychologistProfileSelect;

type PublicRow = Prisma.PsychologistProfileGetPayload<{ select: typeof publicSelect }>;

export const toPublic = ({ user, specializations, ...rest }: PublicRow) => ({
  ...rest,
  fullName: user.fullName,
  specializations: specializations.map((s) => s.specialization),
});

export const visibleWhere = {
  verificationStatus: 'VERIFIED',
  user: { status: 'ACTIVE' },
} satisfies Prisma.PsychologistProfileWhereInput;

function resolveRange(from?: Date, to?: Date) {
  const start = from ?? new Date();
  const end = to ?? new Date(start.getTime() + 14 * 86_400_000);
  if (end <= start) throw badRequest('Rentang tanggal tidak valid');
  if (end.getTime() - start.getTime() > MAX_SLOT_RANGE_DAYS * 86_400_000) {
    throw badRequest(`Rentang tanggal maksimal ${MAX_SLOT_RANGE_DAYS} hari`);
  }
  return { start, end };
}

// ---------- Public ----------

export function listSpecializations() {
  return prisma.specialization.findMany({ orderBy: { name: 'asc' } });
}

export async function listPublic(q: { specialization?: string; page: number; pageSize: number }) {
  const where: Prisma.PsychologistProfileWhereInput = {
    ...visibleWhere,
    ...(q.specialization && { specializations: { some: { specialization: { slug: q.specialization } } } }),
  };
  const [rows, total] = await prisma.$transaction([
    prisma.psychologistProfile.findMany({
      where,
      select: publicSelect,
      orderBy: { yearsExperience: 'desc' },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
    prisma.psychologistProfile.count({ where }),
  ]);
  return { items: rows.map(toPublic), total, page: q.page, pageSize: q.pageSize };
}

export async function getPublic(id: string) {
  const row = await prisma.psychologistProfile.findFirst({ where: { id, ...visibleWhere }, select: publicSelect });
  if (!row) throw notFound('Psikolog tidak ditemukan');
  return toPublic(row);
}

export async function listAvailableSlots(psychologistId: string, from?: Date, to?: Date) {
  await getPublic(psychologistId);
  const { start, end } = resolveRange(from, to);
  const earliest = new Date(Date.now() + BOOKING_MIN_LEAD_MINUTES * 60_000);
  return prisma.availabilitySlot.findMany({
    where: {
      psychologistId,
      status: 'AVAILABLE',
      startAt: { gte: start > earliest ? start : earliest, lt: end },
    },
    select: { id: true, startAt: true, endAt: true },
    orderBy: { startAt: 'asc' },
  });
}

// ---------- Psychologist (self) ----------

export async function requireOwnProfile(userId: string) {
  const profile = await prisma.psychologistProfile.findUnique({ where: { userId } });
  if (!profile) throw notFound('Profil psikolog tidak ditemukan');
  return profile;
}

export async function getOwnProfile(userId: string) {
  const profile = await prisma.psychologistProfile.findUnique({
    where: { userId },
    select: {
      ...publicSelect,
      verificationStatus: true,
      verifiedAt: true,
    },
  });
  if (!profile) throw notFound('Profil psikolog tidak ditemukan');
  const { verificationStatus, verifiedAt, ...rest } = profile;
  return { ...toPublic(rest), verificationStatus, verifiedAt };
}

export async function updateOwnProfile(req: Request, userId: string, input: ProfileInput) {
  const profile = await requireOwnProfile(userId);
  const specIds = [...new Set(input.specializationIds)];
  if (specIds.length) {
    const found = await prisma.specialization.count({ where: { id: { in: specIds } } });
    if (found !== specIds.length) throw badRequest('Spesialisasi tidak valid');
  }

  await prisma.$transaction([
    prisma.psychologistProfile.update({
      where: { id: profile.id },
      data: {
        title: input.title || null,
        bio: input.bio || null,
        yearsExperience: input.yearsExperience,
        pricePerSession: input.pricePerSession,
      },
    }),
    prisma.psychologistSpecialization.deleteMany({ where: { psychologistId: profile.id } }),
    prisma.psychologistSpecialization.createMany({
      data: specIds.map((specializationId) => ({ psychologistId: profile.id, specializationId })),
    }),
  ]);
  await audit(req, { action: 'psychologist.update_profile', entityType: 'PsychologistProfile', entityId: profile.id });
  return getOwnProfile(userId);
}

export async function uploadDocument(
  req: Request,
  userId: string,
  input: DocumentInput,
  file: { buffer: Buffer; ext: 'pdf' | 'png' | 'jpg'; mime: string },
) {
  const profile = await requireOwnProfile(userId);
  const fileKey = await saveFile(file.buffer, file.ext);

  const doc = await prisma.$transaction(async (tx) => {
    const created = await tx.verificationDocument.create({
      data: {
        psychologistId: profile.id,
        type: input.type,
        numberEnc: encrypt(input.number),
        fileKey,
        mimeType: file.mime,
        expiresAt: input.expiresAt,
      },
    });
    if (profile.verificationStatus === 'REJECTED') {
      await tx.psychologistProfile.update({ where: { id: profile.id }, data: { verificationStatus: 'PENDING' } });
    }
    return created;
  });

  await audit(req, {
    action: 'psychologist.upload_document',
    entityType: 'VerificationDocument',
    entityId: doc.id,
    metadata: { type: doc.type },
  });
  return { id: doc.id, type: doc.type, status: doc.status, createdAt: doc.createdAt };
}

export async function listOwnDocuments(userId: string) {
  const profile = await requireOwnProfile(userId);
  const docs = await prisma.verificationDocument.findMany({
    where: { psychologistId: profile.id },
    orderBy: { createdAt: 'desc' },
  });
  return docs.map((d) => ({
    id: d.id,
    type: d.type,
    number: decrypt(d.numberEnc),
    expiresAt: d.expiresAt,
    status: d.status,
    reviewNote: d.reviewNote,
    createdAt: d.createdAt,
  }));
}

export async function listOwnSlots(userId: string, from?: Date, to?: Date) {
  const profile = await requireOwnProfile(userId);
  const { start, end } = resolveRange(from, to);
  return prisma.availabilitySlot.findMany({
    where: { psychologistId: profile.id, startAt: { gte: start, lt: end } },
    select: { id: true, startAt: true, endAt: true, status: true },
    orderBy: { startAt: 'asc' },
  });
}

export async function createSlots(req: Request, userId: string, input: CreateSlotsInput) {
  const profile = await requireOwnProfile(userId);
  if (profile.verificationStatus !== 'VERIFIED') {
    throw forbidden('Jadwal hanya bisa dibuat setelah akun diverifikasi');
  }

  const now = Date.now();
  const slots = [...input.slots].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  for (let i = 0; i < slots.length; i++) {
    if (slots[i].startAt.getTime() <= now) throw badRequest('Slot harus di masa depan');
    if (i > 0 && slots[i].startAt < slots[i - 1].endAt) throw badRequest('Slot yang diajukan saling tumpang tindih');
  }

  const overlap = await prisma.availabilitySlot.findFirst({
    where: {
      psychologistId: profile.id,
      status: { not: 'BLOCKED' },
      OR: slots.map((s) => ({ startAt: { lt: s.endAt }, endAt: { gt: s.startAt } })),
    },
    select: { startAt: true },
  });
  if (overlap) throw conflict('Sebagian slot bertabrakan dengan jadwal yang sudah ada');

  const { count } = await prisma.availabilitySlot.createMany({
    data: slots.map((s) => ({ psychologistId: profile.id, startAt: s.startAt, endAt: s.endAt })),
  });
  await audit(req, { action: 'psychologist.create_slots', metadata: { count } });
  return { created: count };
}

export async function removeSlot(req: Request, userId: string, slotId: string) {
  const profile = await requireOwnProfile(userId);
  const slot = await prisma.availabilitySlot.findFirst({
    where: { id: slotId, psychologistId: profile.id },
    include: { _count: { select: { bookings: true } } },
  });
  if (!slot) throw notFound('Slot tidak ditemukan');
  if (slot.status !== 'AVAILABLE') throw conflict('Slot yang sedang dipesan tidak bisa dihapus');

  // Keep slots referenced by past bookings for history; just block them.
  const where = { id: slot.id, status: 'AVAILABLE' as const };
  const { count } = slot._count.bookings
    ? await prisma.availabilitySlot.updateMany({ where, data: { status: 'BLOCKED' } })
    : await prisma.availabilitySlot.deleteMany({ where });
  if (!count) throw conflict('Slot baru saja dipesan');
  await audit(req, { action: 'psychologist.remove_slot', entityType: 'AvailabilitySlot', entityId: slot.id });
}

// ---------- Admin verification ----------

export async function listForVerification(q: { status: 'PENDING' | 'VERIFIED' | 'REJECTED'; page: number; pageSize: number }) {
  const where = { verificationStatus: q.status };
  const [rows, total] = await prisma.$transaction([
    prisma.psychologistProfile.findMany({
      where,
      include: {
        user: { select: { fullName: true, email: true, status: true } },
        documents: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { createdAt: 'asc' },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
    prisma.psychologistProfile.count({ where }),
  ]);
  return {
    items: rows.map((p) => ({
      id: p.id,
      fullName: p.user.fullName,
      email: p.user.email,
      title: p.title,
      yearsExperience: p.yearsExperience,
      verificationStatus: p.verificationStatus,
      createdAt: p.createdAt,
      documents: p.documents.map((d) => ({
        id: d.id,
        type: d.type,
        number: decrypt(d.numberEnc),
        expiresAt: d.expiresAt,
        status: d.status,
        reviewNote: d.reviewNote,
        createdAt: d.createdAt,
      })),
    })),
    total,
    page: q.page,
    pageSize: q.pageSize,
  };
}

export async function getDocumentForAdmin(req: Request, documentId: string) {
  const doc = await prisma.verificationDocument.findUnique({ where: { id: documentId } });
  if (!doc) throw notFound('Dokumen tidak ditemukan');
  await audit(req, { action: 'admin.view_document', entityType: 'VerificationDocument', entityId: doc.id });
  return doc;
}

export async function verify(req: Request, profileId: string) {
  const profile = await prisma.psychologistProfile.findUnique({
    where: { id: profileId },
    include: { documents: { where: { status: { in: ['PENDING', 'APPROVED'] } } } },
  });
  if (!profile) throw notFound('Psikolog tidak ditemukan');
  const types = new Set(profile.documents.map((d) => d.type));
  if (!types.has('STR') || !types.has('SIPP')) throw badRequest('Dokumen STR dan SIPP wajib ada sebelum verifikasi');

  const now = new Date();
  await prisma.$transaction([
    prisma.verificationDocument.updateMany({
      where: { psychologistId: profileId, status: 'PENDING' },
      data: { status: 'APPROVED', reviewNote: null },
    }),
    prisma.psychologistProfile.update({
      where: { id: profileId },
      data: { verificationStatus: 'VERIFIED', verifiedAt: now, verifiedById: req.user!.id },
    }),
  ]);
  await audit(req, { action: 'admin.verify_psychologist', entityType: 'PsychologistProfile', entityId: profileId });
}

export async function reject(req: Request, profileId: string, note: string) {
  const profile = await prisma.psychologistProfile.findUnique({ where: { id: profileId } });
  if (!profile) throw notFound('Psikolog tidak ditemukan');

  await prisma.$transaction([
    prisma.verificationDocument.updateMany({
      where: { psychologistId: profileId, status: 'PENDING' },
      data: { status: 'REJECTED', reviewNote: note },
    }),
    prisma.psychologistProfile.update({
      where: { id: profileId },
      data: { verificationStatus: 'REJECTED', verifiedAt: null, verifiedById: req.user!.id },
    }),
  ]);
  await audit(req, { action: 'admin.reject_psychologist', entityType: 'PsychologistProfile', entityId: profileId });
}
