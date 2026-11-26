import { z } from 'zod';

export const BOOKING_MIN_LEAD_MINUTES = 30;
export const PAYMENT_HOLD_MINUTES = 15;
export const USER_CANCEL_MIN_HOURS = 24;
export const MAX_PENDING_BOOKINGS_PER_USER = 2;
// Session room (chat/video) is open from 10 min before start until 15 min after end.
export const SESSION_OPEN_BEFORE_MIN = 10;
export const SESSION_CLOSE_AFTER_MIN = 15;

export function sessionWindow(startAt: Date, endAt: Date) {
  return {
    opensAt: new Date(startAt.getTime() - SESSION_OPEN_BEFORE_MIN * 60_000),
    closesAt: new Date(endAt.getTime() + SESSION_CLOSE_AFTER_MIN * 60_000),
  };
}

export function isSessionOpen(startAt: Date, endAt: Date, now = new Date()) {
  const { opensAt, closesAt } = sessionWindow(startAt, endAt);
  return now >= opensAt && now <= closesAt;
}

export const createBookingSchema = z.object({
  slotId: z.string().uuid(),
  mode: z.enum(['CHAT', 'VIDEO']).default('VIDEO'),
});

export const bookingListQuery = z.object({
  status: z.enum(['PENDING_PAYMENT', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'EXPIRED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const noteSchema = z.object({ content: z.string().trim().min(1).max(10_000) });

export const shareSummarySchema = z.object({ summaryId: z.string().uuid() });

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type BookingListQuery = z.infer<typeof bookingListQuery>;
