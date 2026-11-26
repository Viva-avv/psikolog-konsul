import type { Request } from 'express';
import { prisma } from '../../lib/prisma';
import { audit } from '../../lib/audit';
import { logger } from '../../lib/logger';
import { badRequest, notFound } from '../../lib/errors';
import { createSnapTransaction, getTransactionStatus, type MidtransStatus } from '../../lib/midtrans';
import { findAccessible, getForViewer } from '../bookings/bookings.service';

const FAILED_STATUSES = new Set(['deny', 'cancel', 'expire', 'failure']);

export async function getOrCreateSnap(req: Request, bookingId: string) {
  const viewer = req.user!;
  const b = await findAccessible(viewer, bookingId);
  if (b.status !== 'PENDING_PAYMENT') throw badRequest('Booking ini tidak menunggu pembayaran');
  const msLeft = (b.holdExpiresAt?.getTime() ?? 0) - Date.now();
  if (msLeft < 60_000) throw badRequest('Waktu pembayaran sudah habis, silakan booking ulang');

  const existing = await prisma.payment.findUnique({ where: { bookingId } });
  if (existing?.status === 'PENDING' && existing.snapToken) {
    return { token: existing.snapToken, redirectUrl: existing.snapRedirectUrl };
  }

  // New order id per attempt: Midtrans rejects reused order ids after a failed payment.
  const orderId = `PSI-${b.id.slice(0, 8)}-${Date.now().toString(36)}`;
  const snap = await createSnapTransaction({
    orderId,
    amount: b.price,
    itemName: `Sesi konsultasi ${b.mode === 'VIDEO' ? 'video' : 'chat'}`,
    customerFirstName: b.user.fullName.split(' ')[0],
    expiryMinutes: Math.max(1, Math.floor(msLeft / 60_000)),
  });

  const data = {
    orderId,
    amount: b.price,
    status: 'PENDING' as const,
    snapToken: snap.token,
    snapRedirectUrl: snap.redirect_url,
    transactionStatus: null,
  };
  await prisma.payment.upsert({ where: { bookingId }, create: { bookingId, ...data }, update: data });
  await audit(req, { action: 'payment.create', entityType: 'Booking', entityId: b.id, metadata: { orderId } });
  return { token: snap.token, redirectUrl: snap.redirect_url };
}

/** Idempotent: safe to call repeatedly with the same status (webhook retries, manual sync). */
export async function applyStatus(status: MidtransStatus) {
  const payment = await prisma.payment.findUnique({
    where: { orderId: status.order_id },
    include: { booking: { select: { id: true, slotId: true } } },
  });
  if (!payment) {
    logger.warn({ orderId: status.order_id }, 'Midtrans status for unknown/superseded order');
    return;
  }
  if (Math.round(Number(status.gross_amount)) !== payment.amount) {
    logger.error({ orderId: status.order_id }, 'Midtrans amount mismatch, ignoring');
    return;
  }

  const ts = status.transaction_status;
  const common = {
    transactionStatus: ts,
    midtransTransactionId: status.transaction_id,
    paymentType: status.payment_type,
  };
  const isPaid = ts === 'settlement' || (ts === 'capture' && (status.fraud_status ?? 'accept') === 'accept');
  const { id: bookingId, slotId } = payment.booking;

  if (isPaid) {
    let outcome: 'confirmed' | 'reclaimed' | 'refund' | 'duplicate' = 'duplicate';
    await prisma.$transaction(async (tx) => {
      const settled = await tx.payment.updateMany({
        where: { id: payment.id, status: { not: 'SETTLED' } },
        data: { ...common, status: 'SETTLED', paidAt: new Date() },
      });
      if (!settled.count) return;

      const confirmed = await tx.booking.updateMany({
        where: { id: bookingId, status: 'PENDING_PAYMENT' },
        data: { status: 'CONFIRMED', holdExpiresAt: null },
      });
      if (confirmed.count) {
        await tx.availabilitySlot.update({ where: { id: slotId }, data: { status: 'BOOKED' } });
        outcome = 'confirmed';
        return;
      }

      // Paid after the hold expired: honour it if the slot is still free, otherwise flag for refund.
      const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId }, select: { status: true } });
      if (booking.status === 'EXPIRED') {
        const reclaimed = await tx.availabilitySlot.updateMany({
          where: { id: slotId, status: 'AVAILABLE' },
          data: { status: 'BOOKED' },
        });
        if (reclaimed.count) {
          await tx.booking.update({ where: { id: bookingId }, data: { status: 'CONFIRMED', holdExpiresAt: null } });
          outcome = 'reclaimed';
          return;
        }
      }
      await tx.payment.update({ where: { id: payment.id }, data: { refundRequired: true } });
      outcome = 'refund';
    });
    if (outcome !== 'duplicate') {
      await audit(null, { action: `payment.settled.${outcome}`, entityType: 'Payment', entityId: payment.id });
    }
    return;
  }

  if (FAILED_STATUSES.has(ts)) {
    // Booking stays PENDING_PAYMENT until its hold expires so the user can retry with another method.
    await prisma.payment.updateMany({
      where: { id: payment.id, status: 'PENDING' },
      data: { ...common, status: ts === 'expire' ? 'EXPIRED' : 'FAILED' },
    });
    return;
  }

  await prisma.payment.updateMany({ where: { id: payment.id, status: 'PENDING' }, data: common });
}

export async function syncPayment(req: Request, bookingId: string) {
  const viewer = req.user!;
  await findAccessible(viewer, bookingId);
  const payment = await prisma.payment.findUnique({ where: { bookingId } });
  if (!payment) throw notFound('Belum ada transaksi pembayaran');
  const status = await getTransactionStatus(payment.orderId);
  if (status) await applyStatus(status);
  return getForViewer(viewer, bookingId);
}
