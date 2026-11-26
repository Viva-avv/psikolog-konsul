import type { Request } from 'express';
import type { AssessmentType } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../../lib/prisma';
import { complete, parseJsonObject } from '../../../lib/claude';
import { decryptJson, encryptJson } from '../../../lib/crypto';
import { audit } from '../../../lib/audit';
import { AppError, badRequest, notFound } from '../../../lib/errors';
import { logger } from '../../../lib/logger';
import { hasConsent, requireConsent } from '../../consents/consents.service';
import { SUMMARY_SYSTEM_PROMPT, summaryJsonSchema } from '../prompts';
import { sanitizeInput } from '../guard';
import { classifierCheck, keywordCheck, recordIncident } from '../crisis/detector';
import { crisisResponse } from '../chat.service';
import { recommendPsychologists } from '../recommendation';
import { ANSWER_OPTIONS, QUESTIONNAIRES, phq9SelfHarmAnswer, score } from './questionnaires';

interface StoredResult {
  answers: number[];
  score: number;
  severity: string;
}

const SCORE_WINDOW_DAYS = 30;
const ELEVATED_SCORE = 10;

export function getQuestionnaire(type: AssessmentType) {
  return { type, ...QUESTIONNAIRES[type], options: ANSWER_OPTIONS };
}

export async function submit(req: Request, userId: string, type: AssessmentType, answers: number[]) {
  const expected = QUESTIONNAIRES[type].items.length;
  if (answers.length !== expected) throw badRequest(`Jumlah jawaban harus ${expected}`);

  const result = score(type, answers);
  const selfHarm = type === 'PHQ9' ? phq9SelfHarmAnswer(answers) : 0;
  if (selfHarm > 0) {
    await recordIncident(userId, 'ASSESSMENT', {
      isCrisis: true,
      trigger: 'PHQ9_ITEM9',
      category: 'SUICIDAL',
      riskLevel: selfHarm >= 2 ? 'HIGH' : 'MEDIUM',
    });
  }

  let id: string | null = null;
  if (await hasConsent(userId, 'STORE_ASSESSMENT')) {
    const saved = await prisma.assessment.create({
      data: { userId, type, resultEnc: encryptJson({ answers, ...result } satisfies StoredResult) },
    });
    id = saved.id;
    await audit(req, { action: 'assessment.submit', entityType: 'Assessment', entityId: id, metadata: { type } });
  }

  return {
    id,
    type,
    ...result,
    maxScore: expected * 3,
    saved: Boolean(id),
    ...(selfHarm > 0 && { crisis: crisisResponse().crisis }),
  };
}

export async function list(userId: string) {
  const rows = await prisma.assessment.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 });
  return rows.map((r) => {
    const { score: s, severity } = decryptJson<StoredResult>(r.resultEnc);
    return { id: r.id, type: r.type, score: s, severity, createdAt: r.createdAt };
  });
}

async function latestScores(userId: string) {
  const since = new Date(Date.now() - SCORE_WINDOW_DAYS * 86_400_000);
  const out: Array<{ type: AssessmentType; score: number; severity: string }> = [];
  for (const type of ['PHQ9', 'GAD7'] as const) {
    const row = await prisma.assessment.findFirst({
      where: { userId, type, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
    });
    if (row) {
      const { score: s, severity } = decryptJson<StoredResult>(row.resultEnc);
      out.push({ type, score: s, severity });
    }
  }
  return out;
}

const aiSummarySchema = z.object({
  chiefComplaint: z.string().max(600),
  keyThemes: z.array(z.string().max(120)).max(6),
  duration: z.string().max(150).nullable(),
  functionalImpact: z.string().max(600).nullable(),
  userGoals: z.string().max(400).nullable(),
  suggestedSpecializations: z.array(z.string()).max(3),
});

export type SummaryContent = z.infer<typeof aiSummarySchema> & {
  assessments: Array<{ type: AssessmentType; score: number; severity: string }>;
  generatedAt: string;
};

export async function generateSummary(req: Request, userId: string, rawComplaint: string) {
  await requireConsent(userId, 'AI_PROCESSING');
  await requireConsent(userId, 'STORE_ASSESSMENT');

  const complaint = sanitizeInput(rawComplaint);
  const keyword = keywordCheck(complaint);
  const risk = keyword.isCrisis ? keyword : await classifierCheck([complaint]);
  if (risk.isCrisis) {
    await recordIncident(userId, 'ASSESSMENT', risk);
    return crisisResponse();
  }

  const assessments = await latestScores(userId);
  const specs = await prisma.specialization.findMany({ select: { slug: true } });
  const validSlugs = new Set(specs.map((s) => s.slug));

  let parsed: z.infer<typeof aiSummarySchema>;
  try {
    const raw = await complete({
      system: SUMMARY_SYSTEM_PROMPT.replace('{SLUGS}', [...validSlugs].join(', ')),
      messages: [{ role: 'user', content: `<input>${JSON.stringify({ complaint, assessments })}</input>` }],
      maxTokens: 800,
      jsonSchema: summaryJsonSchema([...validSlugs]),
    });
    parsed = aiSummarySchema.parse(parseJsonObject(raw));
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error({ err }, 'Summary generation failed');
    throw new AppError(503, 'AI_UNAVAILABLE', 'Gagal membuat ringkasan, coba lagi nanti');
  }

  const content: SummaryContent = {
    ...parsed,
    suggestedSpecializations: parsed.suggestedSpecializations.filter((s) => validSlugs.has(s)),
    assessments,
    generatedAt: new Date().toISOString(),
  };
  // Raw complaint text is not stored (data minimization); only the structured summary is.
  const saved = await prisma.assessmentSummary.create({ data: { userId, contentEnc: encryptJson(content) } });
  await audit(req, { action: 'assessment.summary_create', entityType: 'AssessmentSummary', entityId: saved.id });

  return {
    type: 'SUMMARY' as const,
    summary: { id: saved.id, createdAt: saved.createdAt, ...content },
    recommendations: await recommendPsychologists(recommendationSlugs(content)),
  };
}

function recommendationSlugs(content: SummaryContent) {
  const slugs = new Set(content.suggestedSpecializations);
  for (const a of content.assessments) {
    if (a.score >= ELEVATED_SCORE) slugs.add(a.type === 'PHQ9' ? 'depresi' : 'kecemasan');
  }
  return [...slugs];
}

export async function listSummaries(userId: string) {
  const rows = await prisma.assessmentSummary.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  return rows.map((r) => ({ id: r.id, createdAt: r.createdAt, ...decryptJson<SummaryContent>(r.contentEnc) }));
}

export async function getOwnSummary(userId: string, id: string) {
  const row = await prisma.assessmentSummary.findFirst({ where: { id, userId } });
  if (!row) throw notFound('Ringkasan tidak ditemukan');
  return { id: row.id, createdAt: row.createdAt, ...decryptJson<SummaryContent>(row.contentEnc) };
}

export async function recommendationsFor(userId: string, summaryId?: string) {
  if (!summaryId) return recommendPsychologists([]);
  return recommendPsychologists(recommendationSlugs(await getOwnSummary(userId, summaryId)));
}
