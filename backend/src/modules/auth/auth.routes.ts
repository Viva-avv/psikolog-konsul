import { Router, type CookieOptions, type Response } from 'express';
import { env } from '../../config/env';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { authLimiter } from '../../middleware/rateLimit';
import { getProfile } from '../users/users.service';
import { loginSchema, registerSchema } from './auth.schema';
import * as authService from './auth.service';

const REFRESH_COOKIE = 'rt';
const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.isProd,
  sameSite: 'strict',
  path: '/api/v1/auth',
};

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, { ...cookieOptions, maxAge: env.REFRESH_TOKEN_TTL_DAYS * 86_400_000 });
}

export const authRouter = Router();

authRouter.post('/register', authLimiter, validate({ body: registerSchema }), async (req, res) => {
  const { refreshToken, ...result } = await authService.register(req, req.body);
  setRefreshCookie(res, refreshToken);
  res.status(201).json(result);
});

authRouter.post('/login', authLimiter, validate({ body: loginSchema }), async (req, res) => {
  const { refreshToken, ...result } = await authService.login(req, req.body);
  setRefreshCookie(res, refreshToken);
  res.json(result);
});

authRouter.post('/refresh', async (req, res) => {
  try {
    const { refreshToken, ...result } = await authService.refresh(req, req.cookies?.[REFRESH_COOKIE]);
    setRefreshCookie(res, refreshToken);
    res.json(result);
  } catch (err) {
    res.clearCookie(REFRESH_COOKIE, cookieOptions);
    throw err;
  }
});

authRouter.post('/logout', async (req, res) => {
  await authService.logout(req, req.cookies?.[REFRESH_COOKIE]);
  res.clearCookie(REFRESH_COOKIE, cookieOptions);
  res.status(204).end();
});

authRouter.get('/me', authenticate, async (req, res) => {
  res.json({ user: await getProfile(req.user!.id) });
});
