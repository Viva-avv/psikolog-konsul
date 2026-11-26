import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../../middleware/auth';
import { parsedParams, validate } from '../../middleware/validate';
import { logger } from '../../lib/logger';
import { getTransactionStatus, midtransStatusSchema, verifySignature } from '../../lib/midtrans';
import { applyStatus, getOrCreateSnap, syncPayment } from './payments.service';

const idParams = z.object({ id: z.string().uuid() });

export const paymentsRouter = Router();

// Public webhook; authenticity is established via signature + re-fetching status from Midtrans.
paymentsRouter.post('/midtrans/notification', async (req, res) => {
  const parsed = midtransStatusSchema.safeParse(req.body);
  if (!parsed.success || !verifySignature(parsed.data)) {
    logger.warn('Rejected Midtrans notification with invalid payload or signature');
    return res.status(403).json({ error: { code: 'INVALID_SIGNATURE', message: 'Invalid signature' } });
  }
  const status = (await getTransactionStatus(parsed.data.order_id)) ?? parsed.data;
  await applyStatus(status);
  return res.json({ ok: true });
});

paymentsRouter.post(
  '/bookings/:id/snap',
  authenticate,
  requireRole('USER'),
  validate({ params: idParams }),
  async (req, res) => {
    res.json(await getOrCreateSnap(req, parsedParams<typeof idParams>(res).id));
  },
);

paymentsRouter.post(
  '/bookings/:id/sync',
  authenticate,
  requireRole('USER'),
  validate({ params: idParams }),
  async (req, res) => {
    res.json({ booking: await syncPayment(req, parsedParams<typeof idParams>(res).id) });
  },
);
