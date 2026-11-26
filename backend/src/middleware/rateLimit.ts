import rateLimit from 'express-rate-limit';

const message = { error: { code: 'RATE_LIMITED', message: 'Terlalu banyak permintaan, coba lagi nanti' } };

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message,
});

export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message,
});

// Per-user limit; must be mounted after `authenticate`.
export const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => `ai:${req.user!.id}`,
  message,
});
