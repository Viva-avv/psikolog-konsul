import { env } from '../config/env';
import { AppError } from './errors';
import { logger } from './logger';

const API = 'https://api.daily.co/v1';

async function dailyFetch<T>(path: string, body: unknown): Promise<T> {
  if (!env.DAILY_API_KEY) throw new AppError(503, 'VIDEO_UNAVAILABLE', 'Layanan video belum dikonfigurasi');
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.DAILY_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    logger.error({ status: res.status, body: await res.text().catch(() => '') }, 'Daily API error');
    throw new AppError(503, 'VIDEO_UNAVAILABLE', 'Gagal menyiapkan ruang video');
  }
  return (await res.json()) as T;
}

const unix = (d: Date) => Math.floor(d.getTime() / 1000);

/** Private 2-person room that cannot be joined before `nbf` and is deleted after `exp`. */
export function createRoom(name: string, nbf: Date, exp: Date) {
  return dailyFetch<{ name: string; url: string }>('/rooms', {
    name,
    privacy: 'private',
    properties: {
      nbf: unix(nbf),
      exp: unix(exp),
      max_participants: 2,
      eject_at_room_exp: true,
      enable_chat: false,
      enable_recording: false,
      enable_prejoin_ui: true,
    },
  });
}

export async function createMeetingToken(roomName: string, userName: string, exp: Date, isOwner: boolean) {
  const { token } = await dailyFetch<{ token: string }>('/meeting-tokens', {
    properties: { room_name: roomName, user_name: userName, exp: unix(exp), is_owner: isOwner, eject_at_token_exp: true },
  });
  return token;
}
