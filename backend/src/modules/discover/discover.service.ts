import type { Request } from 'express';
import { prisma } from '../../lib/prisma';
import { complete } from '../../lib/llm';
import { decryptJson, encryptJson } from '../../lib/crypto';
import { audit } from '../../lib/audit';
import { AppError, notFound } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { hasConsent, requireConsent } from '../consents/consents.service';
import { CRISIS_RESOURCES, recordIncident } from '../ai/crisis/detector';
import { filterOutput } from '../ai/guard';
import { SELF_TEST_INSIGHT_PROMPT } from '../ai/prompts';
import { recommendPsychologists } from '../ai/recommendation';
import { SELF_TESTS, testBySlug, testByType, validateAnswers, type SelfTestDefinition } from './tests';
import type { Evaluation } from './tests/types';
import type { InsightInput } from './discover.schema';

/** Encrypted at rest. Item-level answers are deliberately not stored (data minimisation). */
type StoredResult = Omit<Evaluation, 'safety'> & { crisis: boolean };

const RECOMMENDATION_LIMIT = 3;

export function listTests() {
  return SELF_TESTS.map((t) => ({
    slug: t.slug,
    type: t.type,
    theme: t.theme,
    title: t.title,
    tagline: t.tagline,
    minutes: t.minutes,
    itemCount: t.items.length,
  }));
}

export function getTest(slug: string) {
  const t = testBySlug(slug);
  return {
    slug: t.slug,
    type: t.type,
    theme: t.theme,
    title: t.title,
    tagline: t.tagline,
    description: t.description,
    minutes: t.minutes,
    itemCount: t.items.length,
    source: t.source,
    warning: t.warning ?? null,
    prompt: t.prompt,
    options: t.options ?? null,
    items: t.items,
  };
}

function evaluate(test: SelfTestDefinition, answers: number[]) {
  validateAnswers(test, answers);
  return test.evaluate(answers);
}

async function present(test: SelfTestDefinition, r: Pick<StoredResult, 'headline' | 'result' | 'slugs' | 'crisis'>) {
  return {
    slug: test.slug,
    type: test.type,
    title: test.title,
    headline: r.headline,
    result: r.result,
    recommendations: await recommendPsychologists(r.slugs, RECOMMENDATION_LIMIT),
    ...(r.crisis && { crisis: CRISIS_RESOURCES }),
  };
}

/** Public: anyone can take a test. Results are stored only for signed-in users who consented to STORE_ASSESSMENT. */
export async function submit(req: Request, slug: string, answers: number[]) {
  const test = testBySlug(slug);
  const { safety, ...evaluation } = evaluate(test, answers);
  const stored: StoredResult = { ...evaluation, crisis: safety > 0 };
  const userId = req.user?.role === 'USER' ? req.user.id : null;

  if (stored.crisis && userId) {
    await recordIncident(userId, 'ASSESSMENT', {
      isCrisis: true,
      trigger: 'SELF_TEST_ITEM',
      category: 'SUICIDAL',
      riskLevel: safety >= 2 ? 'HIGH' : 'MEDIUM',
    });
  }

  let saved: { id: string; createdAt: Date } | null = null;
  if (userId && (await hasConsent(userId, 'STORE_ASSESSMENT'))) {
    saved = await prisma.selfTestResult.create({
      data: { userId, type: test.type, resultEnc: encryptJson(stored) },
      select: { id: true, createdAt: true },
    });
    await audit(req, {
      action: 'self_test.submit',
      entityType: 'SelfTestResult',
      entityId: saved.id,
      metadata: { type: test.type },
    });
  }

  return {
    id: saved?.id ?? null,
    createdAt: saved?.createdAt ?? new Date(),
    saved: Boolean(saved),
    ...(await present(test, stored)),
  };
}

async function findOwn(userId: string, id: string) {
  const row = await prisma.selfTestResult.findFirst({ where: { id, userId } });
  if (!row) throw notFound('Hasil tes tidak ditemukan');
  return { row, test: testByType(row.type), stored: decryptJson<StoredResult>(row.resultEnc) };
}

export async function listResults(userId: string) {
  const rows = await prisma.selfTestResult.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 });
  return rows.map((r) => {
    const test = testByType(r.type);
    return {
      id: r.id,
      slug: test.slug,
      type: r.type,
      title: test.title,
      headline: decryptJson<StoredResult>(r.resultEnc).headline,
      createdAt: r.createdAt,
    };
  });
}

export async function getResult(userId: string, id: string) {
  const { row, test, stored } = await findOwn(userId, id);
  return { id: row.id, createdAt: row.createdAt, saved: true, ...(await present(test, stored)) };
}

export async function deleteResult(req: Request, userId: string, id: string) {
  await findOwn(userId, id);
  await prisma.selfTestResult.delete({ where: { id } });
  await audit(req, { action: 'self_test.delete', entityType: 'SelfTestResult', entityId: id });
}

/** AI explanation built only from server-computed facts, never from free text or item-level answers. */
export async function insight(userId: string, input: InsightInput) {
  let facts: Record<string, unknown>;
  let crisis: boolean;
  if ('resultId' in input) {
    ({ facts, crisis } = (await findOwn(userId, input.resultId)).stored);
  } else {
    const evaluation = evaluate(testBySlug(input.slug), input.answers);
    facts = evaluation.facts;
    crisis = evaluation.safety > 0;
  }
  if (crisis) return { type: 'CRISIS' as const, crisis: CRISIS_RESOURCES };

  await requireConsent(userId, 'AI_PROCESSING');
  let text: string;
  try {
    text = await complete({
      system: SELF_TEST_INSIGHT_PROMPT,
      messages: [{ role: 'user', content: `<hasil>${JSON.stringify(facts)}</hasil>` }],
      maxTokens: 450,
    });
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error({ err }, 'Self-test insight failed');
    throw new AppError(503, 'AI_UNAVAILABLE', 'Penjelasan AI sedang tidak tersedia, coba lagi nanti');
  }
  if (!text) throw new AppError(503, 'AI_UNAVAILABLE', 'Penjelasan AI sedang tidak tersedia, coba lagi nanti');
  // The UI renders plain text, so strip markdown emphasis/headings small models add despite the prompt.
  const plain = text.replace(/\*{1,2}([^*\n]+)\*{1,2}/g, '$1').replace(/^#+\s*/gm, '');
  return { type: 'INSIGHT' as const, text: filterOutput(plain).text };
}
