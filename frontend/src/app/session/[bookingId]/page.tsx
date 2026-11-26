'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { RequireRole } from '@/components/RequireRole';
import { SessionChat } from '@/components/SessionChat';
import { VideoPanel } from '@/components/VideoPanel';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDateTime, formatTime } from '@/lib/format';
import type { Booking } from '@/lib/types';

function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function SessionRoom() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const { user } = useAuth();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const now = useNow();

  useEffect(() => {
    api<{ booking: Booking }>(`/bookings/${bookingId}`)
      .then((r) => setBooking(r.booking))
      .catch((e: Error) => setError(e.message));
  }, [bookingId]);

  if (!booking) return <p className="text-sm text-slate-500">{error ?? 'Memuat...'}</p>;
  if (!['CONFIRMED', 'COMPLETED'].includes(booking.status)) {
    return <p className="text-sm text-slate-600">Ruang sesi tersedia setelah booking terkonfirmasi.</p>;
  }

  const isOpen =
    booking.status === 'CONFIRMED' &&
    now >= new Date(booking.sessionOpensAt).getTime() &&
    now <= new Date(booking.sessionClosesAt).getTime();
  const counterpart = user?.role === 'PSYCHOLOGIST' ? booking.client?.fullName : booking.psychologist.fullName;
  const backHref = user?.role === 'PSYCHOLOGIST' ? `/psychologist/clients/${booking.id}` : `/bookings/${booking.id}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Sesi dengan {counterpart}</h1>
          <p className="text-sm text-slate-500">
            {formatDateTime(booking.startAt)} – {formatTime(booking.endAt)} WIB
          </p>
        </div>
        <Link href={backHref} className="text-sm text-teal-700 hover:underline">
          ← Detail sesi
        </Link>
      </div>
      {!isOpen && (
        <p className="rounded-lg bg-slate-100 p-3 text-sm text-slate-600">
          Ruang sesi aktif {formatTime(booking.sessionOpensAt)}–{formatTime(booking.sessionClosesAt)} WIB. Riwayat chat
          tetap dapat dibaca.
        </p>
      )}
      <div className={`grid gap-4 ${booking.mode === 'VIDEO' ? 'lg:grid-cols-[1.6fr_1fr]' : ''}`}>
        {booking.mode === 'VIDEO' && <VideoPanel bookingId={booking.id} canJoin={isOpen} />}
        <SessionChat bookingId={booking.id} canSend={isOpen} />
      </div>
    </div>
  );
}

export default function SessionPage() {
  return (
    <RequireRole roles={['USER', 'PSYCHOLOGIST']}>
      <SessionRoom />
    </RequireRole>
  );
}
