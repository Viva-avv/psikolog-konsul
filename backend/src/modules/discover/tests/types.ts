import type { SelfTestType } from '@prisma/client';

export interface AnswerOption {
  value: number;
  label: string;
}

export interface TestItem {
  text: string;
  /** Overrides the test-level options (e.g. forced-choice items). */
  options?: AnswerOption[];
  /** Heading shown when a new section starts at this item. */
  section?: string;
  /** Item is only asked when an earlier item has the given answer; otherwise it is scored as 0. */
  showIf?: { item: number; value: number };
}

export interface Evaluation {
  headline: string;
  result: object;
  /** Compact, non-identifying facts given to the AI for the optional insight (never item-level answers). */
  facts: Record<string, unknown>;
  slugs: string[];
  /** Answer to a self-harm item (0 = none); > 0 escalates to the crisis flow. */
  safety: number;
}

export interface SelfTestDefinition {
  type: SelfTestType;
  slug: string;
  theme: 'kepribadian' | 'trauma' | 'patah-hati' | 'bahasa-cinta';
  title: string;
  tagline: string;
  description: string;
  minutes: number;
  source: string;
  warning?: string;
  prompt: string;
  options?: AnswerOption[];
  items: TestItem[];
  evaluate(answers: number[]): Evaluation;
}

export type Level = 'Rendah' | 'Sedang' | 'Tinggi';

/** Answers to items whose `showIf` condition is not met are treated as 0. */
export function effectiveAnswers(items: TestItem[], answers: number[]) {
  return answers.map((a, i) => {
    const cond = items[i].showIf;
    return cond && answers[cond.item] !== cond.value ? 0 : a;
  });
}
