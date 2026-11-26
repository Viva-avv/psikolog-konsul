import type { AssessmentType } from '@prisma/client';

// PHQ-9 and GAD-7 (Pfizer) are free to use without permission. Indonesian wording adapted for this app.
export const ANSWER_OPTIONS = [
  { value: 0, label: 'Tidak sama sekali' },
  { value: 1, label: 'Beberapa hari' },
  { value: 2, label: 'Lebih dari separuh waktu' },
  { value: 3, label: 'Hampir setiap hari' },
];

const PROMPT = 'Selama 2 minggu terakhir, seberapa sering Anda terganggu oleh hal-hal berikut?';

export const QUESTIONNAIRES: Record<AssessmentType, { title: string; prompt: string; items: string[] }> = {
  PHQ9: {
    title: 'PHQ-9 (suasana hati)',
    prompt: PROMPT,
    items: [
      'Kurang tertarik atau kurang bersemangat dalam melakukan apa pun',
      'Merasa murung, sedih, atau putus asa',
      'Sulit tidur, mudah terbangun, atau terlalu banyak tidur',
      'Merasa lelah atau kurang bertenaga',
      'Nafsu makan berkurang atau makan berlebihan',
      'Merasa buruk tentang diri sendiri, merasa gagal, atau mengecewakan diri sendiri maupun keluarga',
      'Sulit berkonsentrasi, misalnya saat membaca atau menonton televisi',
      'Bergerak atau berbicara sangat lambat sehingga disadari orang lain, atau sebaliknya sangat gelisah sehingga lebih sering bergerak dari biasanya',
      'Berpikir bahwa lebih baik mati, atau ingin melukai diri sendiri dengan cara apa pun',
    ],
  },
  GAD7: {
    title: 'GAD-7 (kecemasan)',
    prompt: PROMPT,
    items: [
      'Merasa gugup, cemas, atau tegang',
      'Tidak mampu menghentikan atau mengendalikan rasa khawatir',
      'Terlalu mengkhawatirkan berbagai hal',
      'Sulit untuk bersantai',
      'Sangat gelisah sehingga sulit untuk duduk diam',
      'Mudah kesal atau tersinggung',
      'Merasa takut seolah-olah sesuatu yang buruk akan terjadi',
    ],
  },
};

const BANDS: Record<AssessmentType, Array<[max: number, label: string]>> = {
  PHQ9: [
    [4, 'Minimal'],
    [9, 'Ringan'],
    [14, 'Sedang'],
    [19, 'Cukup berat'],
    [27, 'Berat'],
  ],
  GAD7: [
    [4, 'Minimal'],
    [9, 'Ringan'],
    [14, 'Sedang'],
    [21, 'Berat'],
  ],
};

export function score(type: AssessmentType, answers: number[]) {
  const total = answers.reduce((a, b) => a + b, 0);
  const severity = BANDS[type].find(([max]) => total <= max)![1];
  return { score: total, severity };
}

/** PHQ-9 item 9 asks about thoughts of death or self-harm. */
export const phq9SelfHarmAnswer = (answers: number[]) => answers[8] ?? 0;
