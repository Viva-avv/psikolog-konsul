import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth';
import { aiLimiter } from '../../middleware/rateLimit';
import { parsedParams, parsedQuery, validate } from '../../middleware/validate';
import {
  assessmentTypeParams,
  ephemeralChatSchema,
  idParams,
  recommendationQuery,
  sendMessageSchema,
  submitAssessmentSchema,
  summarySchema,
} from './ai.schema';
import * as chat from './chat.service';
import * as assessment from './assessment/assessment.service';

const id = (res: Parameters<typeof parsedParams>[0]) => parsedParams<typeof idParams>(res).id;

export const aiRouter = Router();
aiRouter.use(authenticate, requireRole('USER'));

aiRouter.get('/conversations', async (req, res) => {
  res.json({ items: await chat.listConversations(req.user!.id) });
});

aiRouter.post('/conversations', async (req, res) => {
  res.status(201).json({ conversation: await chat.createConversation(req, req.user!.id) });
});

aiRouter.get('/conversations/:id/messages', validate({ params: idParams }), async (req, res) => {
  res.json(await chat.getMessages(req.user!.id, id(res)));
});

aiRouter.post(
  '/conversations/:id/messages',
  aiLimiter,
  validate({ params: idParams, body: sendMessageSchema }),
  async (req, res) => {
    res.json(await chat.sendMessage(req.user!.id, id(res), req.body.content));
  },
);

aiRouter.delete('/conversations/:id', validate({ params: idParams }), async (req, res) => {
  await chat.deleteConversation(req, req.user!.id, id(res));
  res.status(204).end();
});

aiRouter.post('/chat/ephemeral', aiLimiter, validate({ body: ephemeralChatSchema }), async (req, res) => {
  res.json(await chat.ephemeralChat(req.user!.id, req.body));
});

aiRouter.get('/recommendations', validate({ query: recommendationQuery }), async (req, res) => {
  const { summaryId } = parsedQuery<typeof recommendationQuery>(res);
  res.json({ items: await assessment.recommendationsFor(req.user!.id, summaryId) });
});

export const assessmentsRouter = Router();
assessmentsRouter.use(authenticate, requireRole('USER'));

assessmentsRouter.get('/questionnaires/:type', validate({ params: assessmentTypeParams }), (_req, res) => {
  res.json({ questionnaire: assessment.getQuestionnaire(parsedParams<typeof assessmentTypeParams>(res).type) });
});

assessmentsRouter.get('/', async (req, res) => {
  res.json({ items: await assessment.list(req.user!.id) });
});

assessmentsRouter.post('/', validate({ body: submitAssessmentSchema }), async (req, res) => {
  res.status(201).json(await assessment.submit(req, req.user!.id, req.body.type, req.body.answers));
});

assessmentsRouter.get('/summaries', async (req, res) => {
  res.json({ items: await assessment.listSummaries(req.user!.id) });
});

assessmentsRouter.post('/summaries', aiLimiter, validate({ body: summarySchema }), async (req, res) => {
  res.json(await assessment.generateSummary(req, req.user!.id, req.body.complaint));
});
