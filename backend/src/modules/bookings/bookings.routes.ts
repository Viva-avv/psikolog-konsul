import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../../middleware/auth';
import { parsedParams, parsedQuery, validate } from '../../middleware/validate';
import { bookingListQuery, createBookingSchema, noteSchema, shareSummarySchema } from './bookings.schema';
import * as service from './bookings.service';
import * as sessionChat from '../chat/session-chat.service';
import { joinVideo } from '../video/video.service';

const idParams = z.object({ id: z.string().uuid() });
const bookingId = (res: Parameters<typeof parsedParams>[0]) => parsedParams<typeof idParams>(res).id;

export const bookingsRouter = Router();

bookingsRouter.use(authenticate);

bookingsRouter.post('/', requireRole('USER'), validate({ body: createBookingSchema }), async (req, res) => {
  res.status(201).json({ booking: await service.create(req, req.user!.id, req.body) });
});

bookingsRouter.get('/', requireRole('USER'), validate({ query: bookingListQuery }), async (req, res) => {
  res.json(await service.listForUser(req.user!.id, parsedQuery<typeof bookingListQuery>(res)));
});

bookingsRouter.get('/:id', requireRole('USER', 'PSYCHOLOGIST'), validate({ params: idParams }), async (req, res) => {
  res.json({ booking: await service.getForViewer(req.user!, bookingId(res)) });
});

bookingsRouter.post(
  '/:id/cancel',
  requireRole('USER', 'PSYCHOLOGIST'),
  validate({ params: idParams }),
  async (req, res) => {
    res.json({ booking: await service.cancel(req, bookingId(res)) });
  },
);

bookingsRouter.post('/:id/complete', requireRole('PSYCHOLOGIST'), validate({ params: idParams }), async (req, res) => {
  res.json({ booking: await service.complete(req, bookingId(res)) });
});

bookingsRouter.get('/:id/notes', requireRole('PSYCHOLOGIST'), validate({ params: idParams }), async (req, res) => {
  res.json({ note: await service.getNote(req, bookingId(res)) });
});

bookingsRouter.put(
  '/:id/notes',
  requireRole('PSYCHOLOGIST'),
  validate({ params: idParams, body: noteSchema }),
  async (req, res) => {
    res.json({ note: await service.saveNote(req, bookingId(res), req.body.content) });
  },
);

bookingsRouter.get('/:id/summary', requireRole('USER', 'PSYCHOLOGIST'), validate({ params: idParams }), async (req, res) => {
  res.json({ summary: await service.getSharedSummary(req, bookingId(res)) });
});

bookingsRouter.get('/:id/messages', requireRole('USER', 'PSYCHOLOGIST'), validate({ params: idParams }), async (req, res) => {
  res.json({ items: await sessionChat.history(req.user!, bookingId(res)) });
});

bookingsRouter.get('/:id/video', requireRole('USER', 'PSYCHOLOGIST'), validate({ params: idParams }), async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json(await joinVideo(req, bookingId(res)));
});

bookingsRouter.put(
  '/:id/summary',
  requireRole('USER'),
  validate({ params: idParams, body: shareSummarySchema }),
  async (req, res) => {
    res.json({ booking: await service.shareSummary(req, bookingId(res), req.body.summaryId) });
  },
);

bookingsRouter.delete('/:id/summary', requireRole('USER'), validate({ params: idParams }), async (req, res) => {
  res.json({ booking: await service.unshareSummary(req, bookingId(res)) });
});
