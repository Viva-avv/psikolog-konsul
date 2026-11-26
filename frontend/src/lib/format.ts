import type { BookingStatus } from './types';

const TZ = 'Asia/Jakarta';

export const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: TZ }).format(new Date(iso));

export const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ }).format(
    new Date(iso),
  );

export const formatTime = (iso: string) =>
  new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: TZ }).format(new Date(iso));

export const formatRupiah = (amount: number) =>
  amount === 0
    ? 'Gratis'
    : new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);

export const BOOKING_STATUS: Record<BookingStatus, { label: string; className: string }> = {
  PENDING_PAYMENT: { label: 'Menunggu pembayaran', className: 'bg-amber-100 text-amber-800' },
  CONFIRMED: { label: 'Terkonfirmasi', className: 'bg-teal-100 text-teal-800' },
  COMPLETED: { label: 'Selesai', className: 'bg-slate-200 text-slate-700' },
  CANCELLED: { label: 'Dibatalkan', className: 'bg-red-100 text-red-700' },
  EXPIRED: { label: 'Kedaluwarsa', className: 'bg-slate-100 text-slate-500' },
};
