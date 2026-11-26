import crypto from 'crypto';
import { env } from '../../config/env';

export const MAX_MESSAGE_CHARS = 2000;

/** Normalizes Unicode and strips control/zero-width characters that can hide injected instructions. */
export function sanitizeInput(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_MESSAGE_CHARS);
}

const BLOCKED_OUTPUT: Array<{ pattern: RegExp; fallback: string }> = [
  {
    pattern:
      /\b(\d+\s?(mg|miligram)|sertralin[e]?|fluoksetin|fluoxetine|escitalopram|paroxetine|alprazolam|xanax|clonazepam|diazepam|valium|lorazepam|prozac|zoloft|quetiapin[e]?|risperidon[e]?|litium|lithium|amitriptilin[e]?)\b/i,
    fallback:
      'Maaf, aku tidak bisa memberi saran tentang obat. Untuk pertanyaan seputar obat, sebaiknya konsultasikan langsung dengan psikiater atau dokter. Apakah ada hal lain yang sedang kamu rasakan dan ingin kamu ceritakan?',
  },
  {
    pattern:
      /\b(kamu|anda|kau)\s+(sepertinya\s+|mungkin\s+|jelas\s+)?(mengalami|menderita|mengidap|terkena|punya)\s+(gangguan|depresi\s+(mayor|klinis)|bipolar|skizofrenia|ptsd|ocd|adhd|borderline|bpd)\b/i,
    fallback:
      'Aku tidak bisa memberikan diagnosis. Yang kamu rasakan tetap penting dan layak mendapat perhatian. Psikolog di platform ini bisa membantu memahami kondisimu lebih dalam — kamu bisa mengisi pra-asesmen lalu booking sesi kapan pun kamu siap.',
  },
  {
    pattern: /\b(saya|aku)\s+(adalah\s+)?(seorang\s+)?(psikolog|terapis|psikiater|dokter)\b/i,
    fallback:
      'Perlu aku luruskan: aku adalah asisten AI, bukan psikolog atau terapis. Aku di sini untuk menemanimu bercerita dan membantumu terhubung dengan psikolog berlisensi bila kamu membutuhkannya.',
  },
];

/** Replaces model output that violates hard rules (meds, diagnosis, role claims) with a safe fallback. */
export function filterOutput(text: string): { text: string; blocked: boolean } {
  for (const rule of BLOCKED_OUTPUT) {
    if (rule.pattern.test(text)) return { text: rule.fallback, blocked: true };
  }
  return { text, blocked: false };
}

const historyKey = crypto.createHash('sha256').update(`${env.JWT_ACCESS_SECRET}:ai-history`).digest();

/** Signs assistant messages so clients cannot forge assistant turns in ephemeral (unsaved) chats. */
export function signAssistantMessage(userId: string, content: string) {
  return crypto.createHmac('sha256', historyKey).update(`${userId}\n${content}`).digest('base64url');
}

export function verifyAssistantMessage(userId: string, content: string, sig: string) {
  const expected = Buffer.from(signAssistantMessage(userId, content));
  const given = Buffer.from(sig);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}
