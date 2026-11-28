export interface Specialization {
  id: number;
  slug: string;
  name: string;
}

export interface Psychologist {
  id: string;
  fullName: string;
  title: string | null;
  bio: string | null;
  yearsExperience: number;
  pricePerSession: number;
  specializations: Specialization[];
}

export type VerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

export interface OwnProfile extends Psychologist {
  verificationStatus: VerificationStatus;
  verifiedAt: string | null;
}

export interface Slot {
  id: string;
  startAt: string;
  endAt: string;
  status?: 'AVAILABLE' | 'HELD' | 'BOOKED' | 'BLOCKED';
}

export type BookingStatus = 'PENDING_PAYMENT' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';

export interface Booking {
  id: string;
  mode: 'CHAT' | 'VIDEO';
  status: BookingStatus;
  price: number;
  startAt: string;
  endAt: string;
  sessionOpensAt: string;
  sessionClosesAt: string;
  holdExpiresAt: string | null;
  createdAt: string;
  payment: { status: 'PENDING' | 'SETTLED' | 'FAILED' | 'EXPIRED' | 'REFUNDED'; refundRequired: boolean } | null;
  hasSharedSummary: boolean;
  psychologist: { id: string; fullName: string; title: string | null };
  client?: { fullName: string };
}

export interface VerificationDocument {
  id: string;
  type: 'STR' | 'SIPP';
  number: string;
  expiresAt: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewNote: string | null;
  createdAt: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type ConsentType = 'AI_PROCESSING' | 'STORE_AI_CHAT' | 'STORE_ASSESSMENT';

export interface CrisisInfo {
  message: string;
  contacts: Array<{ label: string; phone: string; extension?: string; tel: string }>;
}

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  sig?: string;
}

export type ChatResult = { type: 'MESSAGE'; message: ChatMessage } | { type: 'CRISIS'; crisis: CrisisInfo };

export interface AssessmentSummary {
  id: string;
  createdAt: string;
  chiefComplaint: string;
  keyThemes: string[];
  duration: string | null;
  functionalImpact: string | null;
  userGoals: string | null;
  suggestedSpecializations: string[];
  assessments: Array<{ type: 'PHQ9' | 'GAD7'; score: number; severity: string }>;
}

export interface Recommendation extends Psychologist {
  nextSlot: { id: string; startAt: string; endAt: string } | null;
  matchCount?: number;
}

// ---------- Temukan Dirimu (self-tests) ----------

export type SelfTestType = 'BIG_FIVE' | 'SIXTEEN_TYPES' | 'TRAUMA' | 'HEARTBREAK' | 'LOVE_LANGUAGE';
export type SelfTestTheme = 'kepribadian' | 'trauma' | 'patah-hati' | 'bahasa-cinta';

export interface SelfTestSummary {
  slug: string;
  type: SelfTestType;
  theme: SelfTestTheme;
  title: string;
  tagline: string;
  minutes: number;
  itemCount: number;
}

export interface SelfTestOption {
  value: number;
  label: string;
}

export interface SelfTest extends SelfTestSummary {
  description: string;
  source: string;
  warning: string | null;
  prompt: string;
  options: SelfTestOption[] | null;
  items: Array<{ text: string; options?: SelfTestOption[]; section?: string; showIf?: { item: number; value: number } }>;
}

export interface BigFiveResult {
  traits: Array<{ key: string; name: string; score: number; max: number; percent: number; level: string; description: string }>;
}

export interface SixteenTypesResult {
  code: string;
  nickname: string;
  summary: string;
  strengths: string[];
  growth: string;
  dimensions: Array<{
    key: string;
    letter: string;
    left: { letter: string; name: string };
    right: { letter: string; name: string };
    leftPercent: number;
  }>;
}

export interface TraumaResult {
  ace: { score: number; max: number; band: string; description: string };
  ptsd: { exposure: boolean; score: number; max: number; positive: boolean; description: string };
  suggestSupport: boolean;
}

export interface HeartbreakResult {
  score: number;
  max: number;
  band: string;
  description: string;
  areas: Array<{ name: string; tip: string }>;
  safetyConcern: boolean;
}

export interface LoveLanguageResult {
  ranking: Array<{ key: string; name: string; description: string; tip: string; score: number; max: number; percent: number }>;
  primary: string[];
}

export type SelfTestOutcome = {
  id: string | null;
  slug: string;
  title: string;
  headline: string;
  createdAt: string;
  saved: boolean;
  recommendations: Recommendation[];
  crisis?: CrisisInfo;
} & (
  | { type: 'BIG_FIVE'; result: BigFiveResult }
  | { type: 'SIXTEEN_TYPES'; result: SixteenTypesResult }
  | { type: 'TRAUMA'; result: TraumaResult }
  | { type: 'HEARTBREAK'; result: HeartbreakResult }
  | { type: 'LOVE_LANGUAGE'; result: LoveLanguageResult }
);

export interface SelfTestHistoryItem {
  id: string;
  slug: string;
  type: SelfTestType;
  title: string;
  headline: string;
  createdAt: string;
}

export type SelfTestInsight = { type: 'INSIGHT'; text: string } | { type: 'CRISIS'; crisis: CrisisInfo };
