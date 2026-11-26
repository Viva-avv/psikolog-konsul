import crypto from 'crypto';
import { z } from 'zod';
import { env } from '../config/env';
import { AppError } from './errors';
import { logger } from './logger';

const urls = () =>
  env.MIDTRANS_IS_PRODUCTION
    ? { snap: 'https://app.midtrans.com/snap/v1', core: 'https://api.midtrans.com/v2' }
    : { snap: 'https://app.sandbox.midtrans.com/snap/v1', core: 'https://api.sandbox.midtrans.com/v2' };

function serverKey() {
  if (!env.MIDTRANS_SERVER_KEY) throw new AppError(503, 'PAYMENT_UNAVAILABLE', 'Pembayaran belum dikonfigurasi');
  return env.MIDTRANS_SERVER_KEY;
}

const headers = () => ({
  Authorization: `Basic ${Buffer.from(`${serverKey()}:`).toString('base64')}`,
  'Content-Type': 'application/json',
  Accept: 'application/json',
});

export const midtransStatusSchema = z.object({
  order_id: z.string().max(64),
  status_code: z.string().max(5),
  gross_amount: z.string().max(32),
  transaction_status: z.string().max(32),
  signature_key: z.string().max(256).optional(),
  fraud_status: z.string().max(32).optional(),
  transaction_id: z.string().max(64).optional(),
  payment_type: z.string().max(64).optional(),
});
export type MidtransStatus = z.infer<typeof midtransStatusSchema>;

export async function createSnapTransaction(p: {
  orderId: string;
  amount: number;
  itemName: string;
  customerFirstName: string;
  expiryMinutes: number;
}) {
  const res = await fetch(`${urls().snap}/transactions`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      transaction_details: { order_id: p.orderId, gross_amount: p.amount },
      item_details: [{ id: 'SESSION', price: p.amount, quantity: 1, name: p.itemName.slice(0, 50) }],
      // Data minimization: only a first name is sent to the payment processor.
      customer_details: { first_name: p.customerFirstName.slice(0, 50) },
      expiry: { unit: 'minutes', duration: p.expiryMinutes },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    logger.error({ status: res.status, body: await res.text().catch(() => '') }, 'Midtrans Snap error');
    throw new AppError(503, 'PAYMENT_UNAVAILABLE', 'Gagal membuat transaksi pembayaran');
  }
  return (await res.json()) as { token: string; redirect_url: string };
}

/** Authoritative status from Midtrans; null if the customer has not chosen a payment method yet. */
export async function getTransactionStatus(orderId: string): Promise<MidtransStatus | null> {
  const res = await fetch(`${urls().core}/${encodeURIComponent(orderId)}/status`, {
    headers: headers(),
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await res.json().catch(() => null)) as { status_code?: string } | null;
  if (!body || body.status_code === '404') return null;
  const parsed = midtransStatusSchema.safeParse(body);
  if (!parsed.success) {
    logger.error({ status: res.status }, 'Unexpected Midtrans status response');
    throw new AppError(503, 'PAYMENT_UNAVAILABLE', 'Gagal memeriksa status pembayaran');
  }
  return parsed.data;
}

/** signature_key = SHA512(order_id + status_code + gross_amount + server_key) */
export function verifySignature(n: MidtransStatus): boolean {
  if (!n.signature_key) return false;
  const expected = crypto
    .createHash('sha512')
    .update(`${n.order_id}${n.status_code}${n.gross_amount}${serverKey()}`)
    .digest('hex');
  const given = Buffer.from(n.signature_key);
  return given.length === expected.length && crypto.timingSafeEqual(Buffer.from(expected), given);
}
