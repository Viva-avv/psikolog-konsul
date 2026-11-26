import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth';
import { parsedParams, parsedQuery, validate } from '../../middleware/validate';
import { openFile } from '../../lib/storage';
import { idParams, rejectSchema, verificationListQuery } from '../psychologists/psychologists.schema';
import * as psychologists from '../psychologists/psychologists.service';
import {
  auditListQuery,
  incidentListQuery,
  incidentUpdateSchema,
  listUsersQuery,
  pageQuery,
  userStatusSchema,
} from './admin.schema';
import * as admin from './admin.service';

const id = (res: Parameters<typeof parsedParams>[0]) => parsedParams<typeof idParams>(res).id;

export const adminRouter = Router();

adminRouter.use(authenticate, requireRole('ADMIN'));

adminRouter.get('/reports/summary', async (_req, res) => {
  res.json(await admin.summaryReport());
});

adminRouter.get('/users', validate({ query: listUsersQuery }), async (_req, res) => {
  res.json(await admin.listUsers(parsedQuery<typeof listUsersQuery>(res)));
});

adminRouter.patch('/users/:id/status', validate({ params: idParams, body: userStatusSchema }), async (req, res) => {
  await admin.setUserStatus(req, id(res), req.body.status);
  res.status(204).end();
});

adminRouter.get('/crisis-incidents', validate({ query: incidentListQuery }), async (_req, res) => {
  res.json(await admin.listIncidents(parsedQuery<typeof incidentListQuery>(res)));
});

adminRouter.post('/crisis-incidents/:id/reveal-contact', validate({ params: idParams }), async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ contact: await admin.revealIncidentContact(req, id(res)) });
});

adminRouter.patch(
  '/crisis-incidents/:id',
  validate({ params: idParams, body: incidentUpdateSchema }),
  async (req, res) => {
    await admin.updateIncident(req, id(res), req.body.status);
    res.status(204).end();
  },
);

adminRouter.get('/refunds', validate({ query: pageQuery }), async (_req, res) => {
  res.json(await admin.listRefunds(parsedQuery<typeof pageQuery>(res)));
});

adminRouter.post('/payments/:id/mark-refunded', validate({ params: idParams }), async (req, res) => {
  await admin.markRefunded(req, id(res));
  res.status(204).end();
});

adminRouter.get('/audit-logs', validate({ query: auditListQuery }), async (_req, res) => {
  res.json(await admin.listAuditLogs(parsedQuery<typeof auditListQuery>(res)));
});

adminRouter.get('/deletion-requests', validate({ query: pageQuery }), async (_req, res) => {
  res.json(await admin.listDeletionRequests(parsedQuery<typeof pageQuery>(res)));
});

adminRouter.get('/psychologists', validate({ query: verificationListQuery }), async (_req, res) => {
  res.json(await psychologists.listForVerification(parsedQuery<typeof verificationListQuery>(res)));
});

adminRouter.get('/documents/:id/file', validate({ params: idParams }), async (req, res) => {
  const doc = await psychologists.getDocumentForAdmin(req, parsedParams<typeof idParams>(res).id);
  const stream = await openFile(doc.fileKey);
  res.setHeader('Content-Type', doc.mimeType);
  res.setHeader('Content-Disposition', `inline; filename="${doc.type}-${doc.id}"`);
  res.setHeader('Cache-Control', 'no-store');
  stream.pipe(res);
});

adminRouter.post('/psychologists/:id/verify', validate({ params: idParams }), async (req, res) => {
  await psychologists.verify(req, parsedParams<typeof idParams>(res).id);
  res.status(204).end();
});

adminRouter.post('/psychologists/:id/reject', validate({ params: idParams, body: rejectSchema }), async (req, res) => {
  await psychologists.reject(req, parsedParams<typeof idParams>(res).id, req.body.note);
  res.status(204).end();
});
