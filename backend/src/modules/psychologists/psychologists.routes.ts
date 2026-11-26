import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth';
import { parsedParams, parsedQuery, validate } from '../../middleware/validate';
import { detectFileType, documentUpload } from '../../middleware/upload';
import { listForPsychologist } from '../bookings/bookings.service';
import { bookingListQuery } from '../bookings/bookings.schema';
import { listAvailableSoon } from '../ai/recommendation';
import {
  createSlotsSchema,
  dateRangeQuery,
  documentSchema,
  idParams,
  listPsychologistsQuery,
  profileSchema,
} from './psychologists.schema';
import * as service from './psychologists.service';

export const specializationsRouter = Router();

specializationsRouter.get('/', async (_req, res) => {
  res.json({ items: await service.listSpecializations() });
});

export const psychologistsRouter = Router();

// ----- Self-service routes (must be registered before "/:id") -----
const me = Router();
me.use(authenticate, requireRole('PSYCHOLOGIST'));

me.get('/profile', async (req, res) => {
  res.json({ profile: await service.getOwnProfile(req.user!.id) });
});

me.put('/profile', validate({ body: profileSchema }), async (req, res) => {
  res.json({ profile: await service.updateOwnProfile(req, req.user!.id, req.body) });
});

me.get('/documents', async (req, res) => {
  res.json({ items: await service.listOwnDocuments(req.user!.id) });
});

me.post('/documents', documentUpload, validate({ body: documentSchema }), async (req, res) => {
  const type = detectFileType(req.file);
  const doc = await service.uploadDocument(req, req.user!.id, req.body, { buffer: req.file!.buffer, ...type });
  res.status(201).json({ document: doc });
});

me.get('/slots', validate({ query: dateRangeQuery }), async (req, res) => {
  const { from, to } = parsedQuery<typeof dateRangeQuery>(res);
  res.json({ items: await service.listOwnSlots(req.user!.id, from, to) });
});

me.post('/slots', validate({ body: createSlotsSchema }), async (req, res) => {
  res.status(201).json(await service.createSlots(req, req.user!.id, req.body));
});

me.delete('/slots/:id', validate({ params: idParams }), async (req, res) => {
  await service.removeSlot(req, req.user!.id, parsedParams<typeof idParams>(res).id);
  res.status(204).end();
});

me.get('/bookings', validate({ query: bookingListQuery }), async (req, res) => {
  res.json(await listForPsychologist(req.user!.id, parsedQuery<typeof bookingListQuery>(res)));
});

psychologistsRouter.use('/me', me);

// ----- Public routes -----
psychologistsRouter.get('/available-now', async (_req, res) => {
  res.json({ items: await listAvailableSoon() });
});

psychologistsRouter.get('/', validate({ query: listPsychologistsQuery }), async (_req, res) => {
  res.json(await service.listPublic(parsedQuery<typeof listPsychologistsQuery>(res)));
});

psychologistsRouter.get('/:id', validate({ params: idParams }), async (_req, res) => {
  res.json({ psychologist: await service.getPublic(parsedParams<typeof idParams>(res).id) });
});

psychologistsRouter.get(
  '/:id/slots',
  validate({ params: idParams, query: dateRangeQuery }),
  async (_req, res) => {
    const { from, to } = parsedQuery<typeof dateRangeQuery>(res);
    res.json({ items: await service.listAvailableSlots(parsedParams<typeof idParams>(res).id, from, to) });
  },
);
