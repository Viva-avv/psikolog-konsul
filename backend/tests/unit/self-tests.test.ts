import { describe, expect, it } from 'vitest';
import { testBySlug, validateAnswers } from '../../src/modules/discover/tests';

const run = (slug: string, answers: number[]) => testBySlug(slug).evaluate(answers);
const fill = (n: number, v: number) => Array<number>(n).fill(v);

describe('Big Five (Mini-IPIP)', () => {
  it('reverse-keys items: "very accurate" to everything is not a high score', () => {
    const { result } = run('big-five', fill(20, 5)) as { result: { traits: Array<{ key: string; score: number; level: string }> } };
    const byKey = Object.fromEntries(result.traits.map((t) => [t.key, t]));
    expect(byKey.E).toMatchObject({ score: 12, level: 'Sedang' });
    // Openness has three reverse-keyed items in the Mini-IPIP.
    expect(byKey.O).toMatchObject({ score: 8, level: 'Rendah' });
  });

  it('scores a consistent extravert at the maximum', () => {
    const answers = fill(20, 3);
    [0, 10].forEach((i) => (answers[i] = 5));
    [5, 15].forEach((i) => (answers[i] = 1));
    const { result } = run('big-five', answers) as { result: { traits: Array<{ key: string; score: number; percent: number }> } };
    expect(result.traits.find((t) => t.key === 'E')).toMatchObject({ score: 20, percent: 100 });
  });
});

describe('16 types', () => {
  it('maps answers through each item\'s own option order', () => {
    expect((run('tipe-kepribadian', fill(20, 0)).result as { code: string }).code).toBe('ESTJ');
    expect((run('tipe-kepribadian', fill(20, 1)).result as { code: string }).code).toBe('INFP');
  });
});

describe('Trauma (ACE + PC-PTSD-5)', () => {
  it('ignores PC-PTSD-5 items when no traumatic event was reported', () => {
    const answers = [...fill(10, 1), 0, ...fill(5, 1)];
    const { result } = run('trauma', answers) as { result: { ace: { score: number }; ptsd: { score: number; positive: boolean }; suggestSupport: boolean } };
    expect(result.ace.score).toBe(10);
    expect(result.ptsd).toMatchObject({ score: 0, positive: false });
    expect(result.suggestSupport).toBe(true);
  });

  it('flags a positive PC-PTSD-5 screen at 3 or more', () => {
    const answers = (ptsd: number[]) => [...fill(10, 0), 1, ...ptsd];
    const positive = (a: number[]) => (run('trauma', a).result as { ptsd: { positive: boolean } }).ptsd.positive;
    expect(positive(answers([1, 1, 1, 0, 0]))).toBe(true);
    expect(positive(answers([1, 1, 0, 0, 0]))).toBe(false);
  });
});

describe('Patah hati', () => {
  it('escalates on the self-harm item and keeps it out of the improvement areas', () => {
    const answers = [...fill(9, 0), 2];
    const evaluation = run('patah-hati', answers);
    expect(evaluation.safety).toBe(2);
    expect(evaluation.result).toMatchObject({ safetyConcern: true, areas: [] });
  });

  it.each([
    [7, 'Ringan'],
    [8, 'Sedang'],
    [16, 'Berat'],
    [27, 'Sangat berat'],
  ])('total %i -> %s', (total, band) => {
    const answers = Array.from({ length: 10 }, (_, i) => (i === 9 ? 0 : Math.max(0, Math.min(3, total - i * 3))));
    expect(run('patah-hati', answers).result).toMatchObject({ score: total, band });
  });
});

describe('Bahasa cinta', () => {
  it('lets a language reach 8 of 8 and ranks it first', () => {
    const words = /memujiku|pesan berisi|bangga|berterima kasih|sayang kamu|menyemangatiku|surat|kagumi/;
    const answers = testBySlug('bahasa-cinta').items.map((item) => Math.max(0, item.options!.findIndex((o) => words.test(o.label))));
    const { result } = run('bahasa-cinta', answers) as { result: { ranking: Array<{ key: string; score: number }>; primary: string[] } };
    expect(result.ranking[0]).toMatchObject({ key: 'WORDS', score: 8 });
    expect(result.primary).toEqual(['Kata-kata Penegasan']);
  });
});

describe('answer validation', () => {
  it('rejects wrong length and values outside each item\'s options', () => {
    expect(() => validateAnswers(testBySlug('big-five'), fill(19, 3))).toThrow('Jumlah jawaban');
    expect(() => validateAnswers(testBySlug('big-five'), fill(20, 0))).toThrow('nomor 1');
    expect(() => validateAnswers(testBySlug('tipe-kepribadian'), fill(20, 2))).toThrow('nomor 1');
    expect(() => validateAnswers(testBySlug('trauma'), fill(16, 0))).not.toThrow();
  });
});
