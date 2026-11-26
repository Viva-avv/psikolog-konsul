import crypto from 'crypto';
import { describe, expect, it } from 'vitest';
import { QUESTIONNAIRES, phq9SelfHarmAnswer, score } from '../../src/modules/ai/assessment/questionnaires';
import { verifySignature } from '../../src/lib/midtrans';
import { isSessionOpen, sessionWindow } from '../../src/modules/bookings/bookings.schema';

describe('PHQ-9 / GAD-7 scoring', () => {
  const answersFor = (total: number, items: number) =>
    Array.from({ length: items }, (_, i) => Math.max(0, Math.min(3, total - i * 3)));

  it('has the standard number of items', () => {
    expect(QUESTIONNAIRES.PHQ9.items).toHaveLength(9);
    expect(QUESTIONNAIRES.GAD7.items).toHaveLength(7);
  });

  it.each([
    [0, 'Minimal'],
    [4, 'Minimal'],
    [5, 'Ringan'],
    [10, 'Sedang'],
    [15, 'Cukup berat'],
    [20, 'Berat'],
    [27, 'Berat'],
  ])('PHQ-9 total %i -> %s', (total, severity) => {
    expect(score('PHQ9', answersFor(total, 9))).toEqual({ score: total, severity });
  });

  it.each([
    [4, 'Minimal'],
    [9, 'Ringan'],
    [14, 'Sedang'],
    [21, 'Berat'],
  ])('GAD-7 total %i -> %s', (total, severity) => {
    expect(score('GAD7', answersFor(total, 7)).severity).toBe(severity);
  });

  it('reads PHQ-9 item 9 (self-harm) for crisis escalation', () => {
    expect(phq9SelfHarmAnswer([0, 0, 0, 0, 0, 0, 0, 0, 2])).toBe(2);
    expect(phq9SelfHarmAnswer([3, 3, 3, 3, 3, 3, 3, 3, 0])).toBe(0);
  });
});

describe('Midtrans notification signature', () => {
  const base = { order_id: 'PSI-abc-1', status_code: '200', gross_amount: '150000.00', transaction_status: 'settlement' };
  const sig = crypto
    .createHash('sha512')
    .update(`${base.order_id}${base.status_code}${base.gross_amount}SB-Mid-server-TEST`)
    .digest('hex');

  it('accepts a valid signature', () => {
    expect(verifySignature({ ...base, signature_key: sig })).toBe(true);
  });

  it('rejects tampered amount, missing or malformed signatures', () => {
    expect(verifySignature({ ...base, gross_amount: '1.00', signature_key: sig })).toBe(false);
    expect(verifySignature(base)).toBe(false);
    expect(verifySignature({ ...base, signature_key: 'abc' })).toBe(false);
  });
});

describe('session window', () => {
  const start = new Date('2026-12-01T10:00:00Z');
  const end = new Date('2026-12-01T11:00:00Z');

  it('opens 10 minutes before and closes 15 minutes after', () => {
    expect(sessionWindow(start, end)).toEqual({
      opensAt: new Date('2026-12-01T09:50:00Z'),
      closesAt: new Date('2026-12-01T11:15:00Z'),
    });
  });

  it.each([
    ['2026-12-01T09:49:59Z', false],
    ['2026-12-01T09:50:00Z', true],
    ['2026-12-01T10:30:00Z', true],
    ['2026-12-01T11:15:00Z', true],
    ['2026-12-01T11:15:01Z', false],
  ])('at %s open=%s', (now, open) => {
    expect(isSessionOpen(start, end, new Date(now))).toBe(open);
  });
});
