import type { Server as HttpServer } from 'http';
import { Server, type Socket } from 'socket.io';
import { z } from 'zod';
import type { Role } from '@prisma/client';
import { env } from '../config/env';
import { verifyAccessToken } from '../lib/jwt';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { AppError } from '../lib/errors';
import { postMessage, requireChatAccess } from '../modules/chat/session-chat.service';

interface SocketData {
  user: { id: string; role: Role };
  joined: Set<string>;
  sentAt: number[];
}

const joinSchema = z.object({ bookingId: z.string().uuid() });
const sendSchema = z.object({ bookingId: z.string().uuid(), content: z.string().min(1).max(2000) });

const RATE_WINDOW_MS = 10_000;
const RATE_MAX = 10;

type Ack = (res: { ok: true; data?: unknown } | { ok: false; error: string }) => void;

const room = (bookingId: string) => `booking:${bookingId}`;

function toErrorMessage(err: unknown) {
  if (err instanceof AppError) return err.message;
  if (err instanceof z.ZodError) return 'Input tidak valid';
  logger.error({ err }, 'Socket handler error');
  return 'Terjadi kesalahan';
}

/** Wraps a handler so it always replies through the ack callback and never throws. */
function handle<T>(socket: Socket, fn: (payload: T, data: SocketData) => Promise<unknown>) {
  return async (payload: T, ack?: Ack) => {
    const reply: Ack = typeof ack === 'function' ? ack : () => undefined;
    try {
      reply({ ok: true, data: await fn(payload, socket.data as SocketData) });
    } catch (err) {
      reply({ ok: false, error: toErrorMessage(err) });
    }
  };
}

export function initSockets(server: HttpServer) {
  const io = new Server(server, {
    cors: { origin: env.corsOrigins, credentials: true },
    maxHttpBufferSize: 16 * 1024,
  });
  const chat = io.of('/chat');

  chat.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (typeof token !== 'string') throw new Error('missing token');
      const payload = verifyAccessToken(token);
      const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, role: true, status: true } });
      if (!user || user.status !== 'ACTIVE' || user.role === 'ADMIN') throw new Error('inactive');
      socket.data = { user: { id: user.id, role: user.role }, joined: new Set(), sentAt: [] } satisfies SocketData;
      next();
    } catch {
      next(new Error('UNAUTHORIZED'));
    }
  });

  chat.on('connection', (socket) => {
    socket.on(
      'booking:join',
      handle(socket, async (payload, data) => {
        const { bookingId } = joinSchema.parse(payload);
        await requireChatAccess(data.user, bookingId);
        data.joined.add(bookingId);
        await socket.join(room(bookingId));
      }),
    );

    socket.on(
      'booking:leave',
      handle(socket, async (payload, data) => {
        const { bookingId } = joinSchema.parse(payload);
        data.joined.delete(bookingId);
        await socket.leave(room(bookingId));
      }),
    );

    socket.on(
      'message:send',
      handle(socket, async (payload, data) => {
        const { bookingId, content } = sendSchema.parse(payload);
        if (!data.joined.has(bookingId)) throw new AppError(403, 'FORBIDDEN', 'Belum bergabung ke ruang sesi');

        const now = Date.now();
        data.sentAt = data.sentAt.filter((t) => now - t < RATE_WINDOW_MS);
        if (data.sentAt.length >= RATE_MAX) throw new AppError(429, 'RATE_LIMITED', 'Terlalu banyak pesan, tunggu sebentar');
        data.sentAt.push(now);

        const message = await postMessage(data.user, bookingId, content);
        socket.to(room(bookingId)).emit('message:new', { ...message, mine: false });
        return { ...message, mine: true };
      }),
    );

    socket.on('typing', (payload: unknown) => {
      const parsed = joinSchema.safeParse(payload);
      const data = socket.data as SocketData;
      if (parsed.success && data.joined.has(parsed.data.bookingId)) {
        socket.to(room(parsed.data.bookingId)).emit('typing', { role: data.user.role });
      }
    });
  });

  return io;
}
