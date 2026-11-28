import { Router } from 'express';
import { authenticate, optionalAuthenticate, requireRole } from '../../middleware/auth';
import { aiLimiter } from '../../middleware/rateLimit';
import { parsedParams, validate } from '../../middleware/validate';
import { insightSchema, resultParams, slugParams, submitSchema } from './discover.schema';
import * as discover from './discover.service';

const slug = (res: Parameters<typeof parsedParams>[0]) => parsedParams<typeof slugParams>(res).slug;
const id = (res: Parameters<typeof parsedParams>[0]) => parsedParams<typeof resultParams>(res).id;
const userOnly = [authenticate, requireRole('USER')];

export const discoverRouter = Router();

discoverRouter.get('/tests', (_req, res) => {
  res.json({ items: discover.listTests() });
});

discoverRouter.get('/tests/:slug', validate({ params: slugParams }), (_req, res) => {
  res.json({ test: discover.getTest(slug(res)) });
});

discoverRouter.post(
  '/tests/:slug',
  optionalAuthenticate,
  validate({ params: slugParams, body: submitSchema }),
  async (req, res) => {
    res.json(await discover.submit(req, slug(res), req.body.answers));
  },
);

discoverRouter.get('/results', ...userOnly, async (req, res) => {
  res.json({ items: await discover.listResults(req.user!.id) });
});

discoverRouter.get('/results/:id', ...userOnly, validate({ params: resultParams }), async (req, res) => {
  res.json(await discover.getResult(req.user!.id, id(res)));
});

discoverRouter.delete('/results/:id', ...userOnly, validate({ params: resultParams }), async (req, res) => {
  await discover.deleteResult(req, req.user!.id, id(res));
  res.status(204).end();
});

discoverRouter.post('/insight', ...userOnly, aiLimiter, validate({ body: insightSchema }), async (req, res) => {
  res.json(await discover.insight(req.user!.id, req.body));
});
