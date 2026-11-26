import { z } from 'zod';
import type { CrisisCategory, CrisisSource, CrisisTrigger, RiskLevel } from '@prisma/client';
import { prisma } from '../../../lib/prisma';
import { complete, parseJsonObject } from '../../../lib/claude';
import { AppError } from '../../../lib/errors';
import { logger } from '../../../lib/logger';
import { CLASSIFIER_JSON_SCHEMA, CLASSIFIER_SYSTEM_PROMPT } from '../prompts';
import { matchCrisisKeywords } from './keywords';

export const CRISIS_RESOURCES = {
  message:
    'Terima kasih sudah mau bercerita. Keselamatanmu adalah yang paling penting saat ini. Kamu tidak harus menghadapi ini sendirian — tolong segera hubungi bantuan profesional.',
  contacts: [
    { label: 'Hotline Kesehatan Jiwa Kemenkes', phone: '119', extension: '8', tel: 'tel:119' },
    { label: 'Layanan darurat', phone: '112', tel: 'tel:112' },
  ],
};

export type RiskAssessment =
  | { isCrisis: false }
  | { isCrisis: true; trigger: CrisisTrigger; category: CrisisCategory; riskLevel: RiskLevel };

const classifierOutput = z.object({
  risk: z.enum(['none', 'low', 'medium', 'high']),
  category: z.enum(['suicidal', 'self_harm', 'harm_to_others', 'other', 'none']),
});

const CATEGORY_MAP: Record<z.infer<typeof classifierOutput>['category'], CrisisCategory> = {
  suicidal: 'SUICIDAL',
  self_harm: 'SELF_HARM',
  harm_to_others: 'OTHER',
  other: 'OTHER',
  none: 'OTHER',
};

/** Layer 1: deterministic keywords on the latest message. Runs before and independently of the LLM. */
export function keywordCheck(latestMessage: string): RiskAssessment {
  const category = matchCrisisKeywords(latestMessage);
  return category ? { isCrisis: true, trigger: 'KEYWORD', category, riskLevel: 'HIGH' } : { isCrisis: false };
}

/** Layer 2: LLM classifier over recent user messages. Throws 503 if unavailable so callers never skip the check. */
export async function classifierCheck(recentUserMessages: string[]): Promise<RiskAssessment> {
  let parsed: z.infer<typeof classifierOutput>;
  try {
    const raw = await complete({
      system: CLASSIFIER_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `<messages>${JSON.stringify(recentUserMessages.slice(-6))}</messages>` }],
      maxTokens: 100,
      effort: 'low',
      jsonSchema: CLASSIFIER_JSON_SCHEMA,
    });
    parsed = classifierOutput.parse(parseJsonObject(raw));
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error({ err }, 'Crisis classifier failed');
    throw new AppError(503, 'AI_UNAVAILABLE', 'Layanan AI sedang tidak tersedia');
  }
  if (parsed.risk === 'high' || parsed.risk === 'medium') {
    return {
      isCrisis: true,
      trigger: 'CLASSIFIER',
      category: CATEGORY_MAP[parsed.category],
      riskLevel: parsed.risk === 'high' ? 'HIGH' : 'MEDIUM',
    };
  }
  return { isCrisis: false };
}

const DEDUPE_WINDOW_MS = 30 * 60_000;

/** Logs metadata only (no message content). Repeated triggers within 30 minutes are merged. */
export async function recordIncident(
  userId: string,
  source: CrisisSource,
  risk: Extract<RiskAssessment, { isCrisis: true }>,
) {
  const recent = await prisma.crisisIncident.findFirst({
    where: { userId, source, status: 'OPEN', createdAt: { gte: new Date(Date.now() - DEDUPE_WINDOW_MS) } },
    select: { id: true, riskLevel: true },
  });
  if (recent) {
    if (recent.riskLevel === 'MEDIUM' && risk.riskLevel === 'HIGH') {
      await prisma.crisisIncident.update({ where: { id: recent.id }, data: { riskLevel: 'HIGH' } });
    }
    return;
  }
  await prisma.crisisIncident.create({
    data: { userId, source, trigger: risk.trigger, category: risk.category, riskLevel: risk.riskLevel },
  });
  logger.warn({ source, trigger: risk.trigger, riskLevel: risk.riskLevel }, 'Crisis incident recorded');
}
