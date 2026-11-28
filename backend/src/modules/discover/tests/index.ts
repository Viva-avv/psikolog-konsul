import type { SelfTestType } from '@prisma/client';
import { badRequest, notFound } from '../../../lib/errors';
import { bigFive } from './bigFive';
import { heartbreak } from './heartbreak';
import { loveLanguage } from './loveLanguage';
import { sixteenTypes } from './sixteenTypes';
import { trauma } from './trauma';
import type { SelfTestDefinition } from './types';

export const SELF_TESTS: SelfTestDefinition[] = [bigFive, sixteenTypes, trauma, heartbreak, loveLanguage];

export const TEST_SLUGS = SELF_TESTS.map((t) => t.slug) as [string, ...string[]];

export function testBySlug(slug: string) {
  const test = SELF_TESTS.find((t) => t.slug === slug);
  if (!test) throw notFound('Tes tidak ditemukan');
  return test;
}

export function testByType(type: SelfTestType) {
  return SELF_TESTS.find((t) => t.type === type)!;
}

/** Every item must be answered with one of its own option values (hidden conditional items included). */
export function validateAnswers(test: SelfTestDefinition, answers: number[]) {
  if (answers.length !== test.items.length) throw badRequest(`Jumlah jawaban harus ${test.items.length}`);
  test.items.forEach((item, i) => {
    const options = item.options ?? test.options ?? [];
    if (!options.some((o) => o.value === answers[i])) throw badRequest(`Jawaban nomor ${i + 1} tidak valid`);
  });
}

export type { SelfTestDefinition } from './types';
