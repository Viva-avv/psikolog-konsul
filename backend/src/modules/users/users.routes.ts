import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { authLimiter } from '../../middleware/rateLimit';
import { audit } from '../../lib/audit';
import * as usersService from './users.service';
import * as privacy from './privacy.service';

const updateSchema = z.object({ fullName: z.string().trim().min(2).max(100).optional() }).strict();

export const usersRouter = Router();

usersRouter.use(authenticate);

usersRouter.get('/me', async (req, res) => {
  res.json({ user: await usersService.getProfile(req.user!.id) });
});

usersRouter.patch('/me', validate({ body: updateSchema }), async (req, res) => {
  const user = await usersService.updateProfile(req.user!.id, req.body);
  await audit(req, { action: 'user.update_profile', entityType: 'User', entityId: user.id });
  res.json({ user });
});

usersRouter.get('/me/export', requireRole('USER'), async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Disposition', 'attachment; filename="data-saya.json"');
  res.json(await privacy.exportData(req, req.user!.id));
});

usersRouter.delete(
  '/me',
  requireRole('USER'),
  authLimiter,
  validate({ body: z.object({ password: z.string().min(1).max(128) }) }),
  async (req, res) => {
    await privacy.deleteAccount(req, req.user!.id, req.body.password);
    res.status(204).end();
  },
);
