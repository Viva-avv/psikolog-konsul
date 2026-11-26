import type { CrisisCategory } from '@prisma/client';

/** Lowercases, undoes common leetspeak, collapses stretched letters ("matiii" -> "mati") and punctuation. */
export function normalizeForMatching(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[013457@$]/g, (c) => ({ '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's' })[c]!)
    .replace(/(\p{L})\1{2,}/gu, '$1')
    .replace(/[^\p{L}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    // "b u n u h diri" -> "bunuh diri"
    .replace(/(?<=(?:^|\s)\p{L}) (?=\p{L}(?:\s|$))/gu, '')
    .trim();
}

const WANT = '(ingin|ingn|pengen|pengin|pingin|kepengen|mau|niat|berencana|rencana|siap)';
const NOT = '(tidak|tdk|gak|ga|gk|nggak|ngga|enggak|engga|tak)';
const ME = '(aku|saya|gue|gw|gua|ku)';

// High-precision patterns only; ambiguous phrasing is left to the LLM classifier.
const PATTERNS: Array<{ category: CrisisCategory; re: RegExp }> = [
  { category: 'OTHER', re: new RegExp(`\\b${ME} ${WANT} (menyakiti|melukai|membunuh|nyakitin) (orang lain|dia|seseorang)\\b`) },
  { category: 'OTHER', re: new RegExp(`\\b${ME} (sedang|lagi) (dipukuli|diserang|diancam|dipukul)\\b`) },
  { category: 'SUICIDAL', re: /\b(bunuh diri|bundir|ngebundir|suicide|suicidal|kill myself|end my life|want to die)\b/ },
  { category: 'SUICIDAL', re: /\b(mengakhiri|akhiri|akhirin|ngakhirin) (hidup|nyawa)\b/ },
  { category: 'SUICIDAL', re: new RegExp(`\\b${WANT} (untuk )?(mati|segera mati|cepat mati)\\b`) },
  { category: 'SUICIDAL', re: new RegExp(`\\b${NOT} (ingin|mau|pengen|pengin) hidup (lagi)?\\b`) },
  { category: 'SUICIDAL', re: new RegExp(`\\blebih baik (${ME} )?mati\\b`) },
  { category: 'SUICIDAL', re: /\b(gantung diri|minum racun|overdosis|overdose|loncat dari (gedung|jembatan|lantai|atap))\b/ },
  { category: 'SELF_HARM', re: /\b(menyakiti|nyakitin|melukai|lukai|ngelukai|sakiti|nyakiti) diri\b/ },
  { category: 'SELF_HARM', re: /\b(menyayat|nyayat|sayat|mengiris|ngiris|iris|silet|nyilet) (tangan|lengan|nadi|kulit|paha|diri)\b/ },
  { category: 'SELF_HARM', re: /\b(self harm|selfharm|potong nadi)\b/ },
];

export function matchCrisisKeywords(text: string): CrisisCategory | null {
  const normalized = normalizeForMatching(text);
  return PATTERNS.find((p) => p.re.test(normalized))?.category ?? null;
}
