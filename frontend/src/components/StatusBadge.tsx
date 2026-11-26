import { BOOKING_STATUS } from '@/lib/format';
import type { BookingStatus } from '@/lib/types';

export function StatusBadge({ status }: { status: BookingStatus }) {
  const { label, className } = BOOKING_STATUS[status];
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>{label}</span>;
}
