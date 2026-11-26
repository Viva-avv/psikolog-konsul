'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { RequireRole } from '@/components/RequireRole';
import { PsychologistNav } from '@/components/PsychologistNav';
import { StatusBadge } from '@/components/StatusBadge';
import { SummaryView } from '@/components/SummaryView';
import { api, ApiError } from '@/lib/api';
import { formatDateTime, formatTime } from '@/lib/format';
import type { AssessmentSummary, Booking } from '@/lib/types';

interface Note {
  content: string;
  updatedAt: string;
}

function ClientSession() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [summary, setSummary] = useState<AssessmentSummary | null>(null);
  const [note, setNote] = useState('');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ booking: Booking }>(`/bookings/${bookingId}`)
      .then((r) => {
        setBooking(r.booking);
        if (['CONFIRMED', 'COMPLETED'].includes(r.booking.status)) {
          if (r.booking.hasSharedSummary) {
            api<{ summary: AssessmentSummary }>(`/bookings/${bookingId}/summary`)
              .then((s) => setSummary(s.summary))
              .catch(() => setSummary(null));
          }
          return api<{ note: Note | null }>(`/bookings/${bookingId}/notes`).then((n) => {
            setNote(n.note?.content ?? '');
            setSavedAt(n.note?.updatedAt ?? null);
          });
        }
      })
      .catch((e: Error) => setError(e.message));
  }, [bookingId]);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Terjadi kesalahan');
    } finally {
      setBusy(false);
    }
  }

  const saveNote = () =>
    run(async () => {
      const r = await api<{ note: Note }>(`/bookings/${bookingId}/notes`, { method: 'PUT', body: { content: note } });
      setSavedAt(r.note.updatedAt);
    });

  const action = (path: 'complete' | 'cancel') =>
    run(async () => {
      if (path === 'cancel' && !confirm('Batalkan sesi ini?')) return;
      const r = await api<{ booking: Booking }>(`/bookings/${bookingId}/${path}`, { method: 'POST' });
      setBooking(r.booking);
    });

  if (!booking) return <p className="text-sm text-slate-500">{error ?? 'Memuat...'}</p>;
  const started = new Date(booking.startAt).getTime() <= Date.now();
  const canNote = booking.status === 'CONFIRMED' || booking.status === 'COMPLETED';

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_1.5fr]">
      <div className="card space-y-3 self-start">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">{booking.client?.fullName}</h1>
          <StatusBadge status={booking.status} />
        </div>
        <p className="text-sm text-slate-600">
          {formatDateTime(booking.startAt)} – {formatTime(booking.endAt)} WIB · {booking.mode === 'VIDEO' ? 'Video' : 'Chat'}
        </p>
        {summary ? (
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="mb-2 text-xs font-medium uppercase text-slate-500">Ringkasan pra-asesmen (dibagikan klien)</p>
            <SummaryView summary={summary} />
          </div>
        ) : (
          <p className="text-xs text-slate-500">Klien tidak membagikan ringkasan pra-asesmen.</p>
        )}
        {booking.status === 'CONFIRMED' && (
          <div className="flex gap-3 pt-2">
            <Link href={`/session/${booking.id}`} className="btn-primary">
              Masuk ruang sesi
            </Link>
            {started ? (
              <button onClick={() => action('complete')} disabled={busy} className="btn-primary">
                Tandai selesai
              </button>
            ) : (
              <button onClick={() => action('cancel')} disabled={busy} className="text-sm text-red-600 hover:underline">
                Batalkan sesi
              </button>
            )}
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      {canNote && (
        <div className="card">
          <h2 className="font-semibold">Catatan sesi</h2>
          <p className="mb-3 text-xs text-slate-500">Terenkripsi dan hanya dapat dilihat oleh Anda.</p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={10_000}
            rows={12}
            className="input font-mono"
          />
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-slate-500">{savedAt && `Tersimpan ${formatDateTime(savedAt)}`}</span>
            <button onClick={saveNote} disabled={busy || !note.trim()} className="btn-primary">
              Simpan catatan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ClientSessionPage() {
  return (
    <RequireRole roles={['PSYCHOLOGIST']}>
      <PsychologistNav />
      <ClientSession />
    </RequireRole>
  );
}
