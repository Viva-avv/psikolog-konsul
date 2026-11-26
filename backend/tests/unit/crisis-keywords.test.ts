import { describe, expect, it } from 'vitest';
import { matchCrisisKeywords, normalizeForMatching } from '../../src/modules/ai/crisis/keywords';
import { keywordCheck } from '../../src/modules/ai/crisis/detector';

describe('crisis keyword detection', () => {
  it.each(['Aku ingin menyakiti orang lain', 'Saya sedang dipukuli'])('prioritizes immediate danger: %s', (text) => {
    expect(keywordCheck(text)).toMatchObject({ isCrisis: true, riskLevel: 'HIGH' });
  });
  it.each([
    'aku pengen mati aja',
    'Saya ingin BUNUH DIRI',
    'kayaknya aku mau bundir',
    'gak mau hidup lagi rasanya',
    'lebih baik aku mati',
    'berencana mengakhiri hidup minggu depan',
    'I want to die',
    'aku pengeeeen matiii',
    'b u n u h diri',
    'bunuh d1r1',
  ])('flags suicidal language: %s', (text) => {
    expect(matchCrisisKeywords(text)).toBe('SUICIDAL');
  });

  it.each(['aku sering nyayat tangan', 'pengen menyakiti diri sendiri', 'kadang self harm'])(
    'flags self-harm language: %s',
    (text) => {
      expect(matchCrisisKeywords(text)).toBe('SELF_HARM');
    },
  );

  it.each([
    'aku capek banget sama kerjaan',
    'hp ku mati terus',
    'mati lampu lagi',
    'aku sedih karena kucingku mati',
    'aku takut gagal ujian',
  ])('does not flag everyday language: %s', (text) => {
    expect(matchCrisisKeywords(text)).toBeNull();
  });

  it('normalizes leetspeak, stretched letters and punctuation', () => {
    expect(normalizeForMatching('B3NC1!!! matiiii...')).toBe('benci mati');
  });

  it('keyword layer escalates to HIGH risk without calling the LLM', () => {
    expect(keywordCheck('pengen bunuh diri')).toEqual({
      isCrisis: true,
      trigger: 'KEYWORD',
      category: 'SUICIDAL',
      riskLevel: 'HIGH',
    });
    expect(keywordCheck('hari ini biasa saja')).toEqual({ isCrisis: false });
  });
});
