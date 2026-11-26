import type { Request } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { audit } from '../../lib/audit';
import { badRequest, conflict, notFound } from '../../lib/errors';

type Page = { page: number; pageSize: number };
const paginate = ({ page, pageSize }: Page) => ({ skip: (page - 1) * pageSize, take: pageSize });

// ---------- Users ----------

export async function listUsers(q: Page & { role?: 'USER' | 'PSYCHOLOGIST' | 'ADMIN'; status?: 'ACTIVE' | 'SUSPENDED'; q?: string }) {
  const where: Prisma.UserWhereInput = {
    deletedAt: null,
    role: q.role,
    status: q.status,
    ...(q.q && {
      OR: [{ email: { contains: q.q, mode: 'insensitive' } }, { fullName: { contains: q.q, mode: 'insensitive' } }],
    }),
  };
  const [items, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      select: { id: true, email: true, fullName: true, role: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      ...paginate(q),
    }),
    prisma.user.count({ where }),
  ]);
  return { items, total, page: q.page, pageSize: q.pageSize };
}

export async function setUserStatus(req: Request, userId: string, status: 'ACTIVE' | 'SUSPENDED') {
  if (userId === req.user!.id) throw badRequest('Tidak dapat mengubah status akun sendiri');
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, status: true } });
  if (!user || user.status === 'DELETED') throw notFound('Pengguna tidak ditemukan');
  if (user.role === 'ADMIN') throw conflict('Status admin tidak dapat diubah dari dashboard');

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { status } }),
    // Suspension takes effect immediately: refresh tokens revoked, access tokens fail the status check.
    ...(status === 'SUSPENDED'
      ? [prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } })]
      : []),
  ]);
  await audit(req, { action: 'admin.user_status', entityType: 'User', entityId: userId, metadata: { status } });
}

// ---------- Reports (aggregates only) ----------

export async function summaryReport() {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [usersByRole, psyByStatus, bookingsByStatus, revenue, refunds, incidentsOpen, incidentsByRisk] =
    await prisma.$transaction([
      prisma.user.groupBy({ by: ['role'], where: { deletedAt: null }, _count: { _all: true }, orderBy: { role: 'asc' } }),
      prisma.psychologistProfile.groupBy({
        by: ['verificationStatus'],
        _count: { _all: true },
        orderBy: { verificationStatus: 'asc' },
      }),
      prisma.booking.groupBy({
        by: ['status'],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
        orderBy: { status: 'asc' },
      }),
      prisma.payment.aggregate({ where: { status: 'SETTLED', paidAt: { gte: since } }, _sum: { amount: true } }),
      prisma.payment.count({ where: { refundRequired: true, status: 'SETTLED' } }),
      prisma.crisisIncident.count({ where: { status: 'OPEN' } }),
      prisma.crisisIncident.groupBy({
        by: ['riskLevel'],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
        orderBy: { riskLevel: 'asc' },
      }),
    ]);

  const toMap = <K extends string>(rows: Array<Record<string, unknown> & { _count: unknown }>, key: K) =>
    Object.fromEntries(rows.map((r) => [r[key] as string, (r._count as { _all: number })._all]));

  return {
    periodDays: 30,
    usersByRole: toMap(usersByRole, 'role'),
    psychologistsByVerification: toMap(psyByStatus, 'verificationStatus'),
    bookingsByStatus: toMap(bookingsByStatus, 'status'),
    revenueSettled: revenue._sum.amount ?? 0,
    pendingRefunds: refunds,
    openCrisisIncidents: incidentsOpen,
    crisisIncidentsByRisk: toMap(incidentsByRisk, 'riskLevel'),
  };
}

// ---------- Crisis incidents ----------

export async function listIncidents(q: Page & { status?: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' }) {
  const where = { status: q.status };
  const [items, total] = await prisma.$transaction([
    prisma.crisisIncident.findMany({
      where,
      // No user identity here; contact details are revealed on demand (audited).
      select: {
        id: true,
        userId: true,
        source: true,
        trigger: true,
        category: true,
        riskLevel: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        handledBy: { select: { fullName: true } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      ...paginate(q),
    }),
    prisma.crisisIncident.count({ where }),
  ]);
  return { items, total, page: q.page, pageSize: q.pageSize };
}

export async function revealIncidentContact(req: Request, id: string) {
  const incident = await prisma.crisisIncident.findUnique({
    where: { id },
    select: { user: { select: { fullName: true, email: true, status: true } } },
  });
  if (!incident) throw notFound('Insiden tidak ditemukan');
  if (!incident.user || incident.user.status === 'DELETED') throw notFound('Pengguna sudah tidak tersedia');
  await audit(req, { action: 'admin.crisis_reveal_contact', entityType: 'CrisisIncident', entityId: id });
  return { fullName: incident.user.fullName, email: incident.user.email };
}

export async function updateIncident(req: Request, id: string, status: 'ACKNOWLEDGED' | 'RESOLVED') {
  const { count } = await prisma.crisisIncident.updateMany({
    where: { id },
    data: { status, handledById: req.user!.id },
  });
  if (!count) throw notFound('Insiden tidak ditemukan');
  await audit(req, { action: 'admin.crisis_update', entityType: 'CrisisIncident', entityId: id, metadata: { status } });
}

// ---------- Refunds ----------

export async function listRefunds(q: Page) {
  const where: Prisma.PaymentWhereInput = { refundRequired: true, status: 'SETTLED' };
  const [items, total] = await prisma.$transaction([
    prisma.payment.findMany({
      where,
      select: {
        id: true,
        orderId: true,
        amount: true,
        paymentType: true,
        midtransTransactionId: true,
        paidAt: true,
        booking: { select: { id: true, status: true, user: { select: { fullName: true, email: true } } } },
      },
      orderBy: { paidAt: 'asc' },
      ...paginate(q),
    }),
    prisma.payment.count({ where }),
  ]);
  return { items, total, page: q.page, pageSize: q.pageSize };
}

export async function markRefunded(req: Request, paymentId: string) {
  const { count } = await prisma.payment.updateMany({
    where: { id: paymentId, refundRequired: true, status: 'SETTLED' },
    data: { status: 'REFUNDED', refundRequired: false },
  });
  if (!count) throw notFound('Pembayaran tidak ditemukan atau tidak memerlukan refund');
  await audit(req, { action: 'admin.payment_refunded', entityType: 'Payment', entityId: paymentId });
}

// ---------- Audit & deletion requests ----------

export async function listAuditLogs(q: Page & { action?: string; actorId?: string }) {
  const where: Prisma.AuditLogWhereInput = {
    actorId: q.actorId,
    ...(q.action && { action: { startsWith: q.action } }),
  };
  const [items, total] = await prisma.$transaction([
    prisma.auditLog.findMany({
      where,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        metadata: true,
        createdAt: true,
        actor: { select: { id: true, email: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      ...paginate(q),
    }),
    prisma.auditLog.count({ where }),
  ]);
  return { items, total, page: q.page, pageSize: q.pageSize };
}

export async function listDeletionRequests(q: Page) {
  const [items, total] = await prisma.$transaction([
    prisma.dataDeletionRequest.findMany({ orderBy: { requestedAt: 'desc' }, ...paginate(q) }),
    prisma.dataDeletionRequest.count(),
  ]);
  return { items, total, page: q.page, pageSize: q.pageSize };
}
