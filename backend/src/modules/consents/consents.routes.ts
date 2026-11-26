import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../../middleware/auth';
import { parsedParams, validate } from '../../middleware/validate';
import { USER_MANAGED_CONSENTS, grant, listActive, revoke } from './consents.service';

const typeSchema = z.object({ type: z.enum(USER_MANAGED_CONSENTS) });

export const consentsRouter = Router();

consentsRouter.use(authenticate, requireRole('USER'));

consentsRouter.get('/', async (req, res) => {
  res.json({ items: await listActive(req.user!.id) });
});

consentsRouter.post('/', validate({ body: typeSchema }), async (req, res) => {
  res.status(201).json({ consent: await grant(req, req.user!.id, req.body.type) });
});

consentsRouter.delete('/:type', validate({ params: typeSchema }), async (req, res) => {
  await revoke(req, req.user!.id, parsedParams<typeof typeSchema>(res).type);
  res.status(204).end();
});
