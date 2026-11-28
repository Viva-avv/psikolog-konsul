import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { logger } from './lib/logger';
import { globalLimiter } from './middleware/rateLimit';
import { errorHandler, notFoundHandler } from './middleware/error';
import { authRouter } from './modules/auth/auth.routes';
import { usersRouter } from './modules/users/users.routes';
import { adminRouter } from './modules/admin/admin.routes';
import { psychologistsRouter, specializationsRouter } from './modules/psychologists/psychologists.routes';
import { bookingsRouter } from './modules/bookings/bookings.routes';
import { consentsRouter } from './modules/consents/consents.routes';
import { aiRouter, assessmentsRouter } from './modules/ai/ai.routes';
import { paymentsRouter } from './modules/payments/payments.routes';
import { discoverRouter } from './modules/discover/discover.routes';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);

  app.use(helmet());
  app.use(cors({ origin: env.corsOrigins, credentials: true }));
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/health' } }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  const api = express.Router();
  api.use(globalLimiter);
  api.use('/auth', authRouter);
  api.use('/users', usersRouter);
  api.use('/admin', adminRouter);
  api.use('/specializations', specializationsRouter);
  api.use('/psychologists', psychologistsRouter);
  api.use('/bookings', bookingsRouter);
  api.use('/consents', consentsRouter);
  api.use('/ai', aiRouter);
  api.use('/assessments', assessmentsRouter);
  api.use('/payments', paymentsRouter);
  api.use('/discover', discoverRouter);
  app.use('/api/v1', api);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
