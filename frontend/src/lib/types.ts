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
