'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { RequireRole } from '@/components/RequireRole';
import { StatusBadge } from '@/components/StatusBadge';
import { SummaryView } from '@/components/SummaryView';
import { PayButton } from '@/components/PayButton';
import { api, ApiError } from '@/lib/api';
import { formatDateTime, formatRupiah, formatTime } from '@/lib/format';
import type { AssessmentSummary, Booking } from '@/lib/types';

function SharePanel({ booking, onChange }: { booking: Booking; onChange: (b: Booking) => void }) {
  const [summaries, setSummaries] = useState<AssessmentSummary[] | null>(null);
  const [shared, setShared] = useState<AssessmentSummary | null>(null);
  const [selected, setSelected] = useState('');
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ items: AssessmentSummary[] }>('/assessments/summaries')
      .then((r) => {
        setSummaries(r.items);
        setSelected(r.items[0]?.id ?? '');
      })
      .catch(() => setSummaries([]));
    if (booking.hasSharedSummary) {
      api<{ summary: AssessmentSummary }>(`/bookings/${booking.id}/summary`)
        .then((r) => setShared(r.summary))
        .catch(() => setShared(null));
    } else {
      setShared(null);
    }
  }, [booking.id, booking.hasSharedSummary]);

  async function update(method: 'PUT' | 'DELETE') {
    setError(null);
    try {
      const r = await api<{ booking: Booking }>(`/bookings/${booking.id}/summary`, {
        method,
        body: method === 'PUT' ? { summaryId: selected } : undefined,
      });
      setAgree(false);
      onChange(r.booking);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Gagal memperbarui');
    }
  }

  return (
    <div className="card max-w-xl space-y-3">
      <h2 className="font-semibold">Ringkasan pra-asesmen untuk psikolog</h2>
      {shared ? (
        <>
          <p className="text-sm text-teal-700">Dibagikan ke {booking.psychologist.fullName}:</p>
          <SummaryView summary={shared} />
          <button onClick={() => update('DELETE')} className="text-sm text-red-600 hover:underline">
            Cabut persetujuan berbagi
          </button>
        </>
      ) : summaries && summaries.length === 0 ? (
        <p className="text-sm text-slate-600">
          Belum ada ringkasan.{' '}
          <Link href="/assessment" className="text-teal-700 underline">
            Isi pra-asesmen
          </Link>{' '}
          untuk membantu psikolog memahami keluhan Anda sebelum sesi.
        </p>
      ) : (
        <>
          <select value={selected} onChange={(e) => setSelected(e.target.value)} className="input">
            {summaries?.map((s) => (
              <option key={s.id} value={s.id}>
                {formatDateTime(s.createdAt)} — {s.chiefComplaint.slice(0, 60)}
              </option>
            ))}
          </select>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1" />
            <span>
              Saya setuju membagikan ringkasan ini kepada {booking.psychologist.fullName} khusus untuk sesi ini. Saya
              dapat mencabutnya kapan saja.
            </span>
          </label>
          <button onClick={() => update('PUT')} disabled={!agree || !selected} className="btn-primary">
            Bagikan
          </button>
        </>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

function BookingDetail() {
  const { id } = useParams<{ id: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ booking: Booking }>(`/bookings/${id}`)
      .then((r) => setBooking(r.booking))
      .catch((e: Error) => setError(e.message));
  }, [id]);

  async function cancel() {
    if (!confirm('Batalkan booking ini?')) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ booking: Booking }>(`/bookings/${id}/cancel`, { method: 'POST' });
      setBooking(r.booking);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Gagal membatalkan');
    } finally {
      setBusy(false);
    }
  }

  if (!booking) return <p className="text-sm text-slate-500">{error ?? 'Memuat...'}</p>;
  const cancellable = booking.status === 'PENDING_PAYMENT' || booking.status === 'CONFIRMED';

  return (
    <div className="space-y-6">
      <div className="card max-w-xl">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Detail sesi</h1>
          <StatusBadge status={booking.status} />
        </div>
        <dl className="mt-4 grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
          <dt className="text-slate-500">Psikolog</dt>
          <dd>
            {booking.psychologist.fullName}
            {booking.psychologist.title && `, ${booking.psychologist.title}`}
          </dd>
          <dt className="text-slate-500">Waktu</dt>
          <dd>
            {formatDateTime(booking.startAt)} – {formatTime(booking.endAt)} WIB
          </dd>
          <dt className="text-slate-500">Metode</dt>
          <dd>{booking.mode === 'VIDEO' ? 'Video call' : 'Chat'}</dd>
          <dt className="text-slate-500">Biaya</dt>
          <dd>{formatRupiah(booking.price)}</dd>
        </dl>

        {booking.status === 'PENDING_PAYMENT' && booking.holdExpiresAt && (
          <>
            <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              Selesaikan pembayaran sebelum {formatTime(booking.holdExpiresAt)} WIB atau slot akan dilepas.
            </p>
            <PayButton bookingId={booking.id} onUpdate={setBooking} />
          </>
        )}

        {(booking.status === 'CONFIRMED' || booking.status === 'COMPLETED') && (
          <Link href={`/session/${booking.id}`} className="btn-primary mt-4 w-full">
            Masuk ruang sesi
          </Link>
        )}

        {booking.payment?.refundRequired && (
          <p className="mt-4 rounded-lg bg-slate-100 p-3 text-sm text-slate-700">
            Pembayaran Anda akan dikembalikan. Tim kami akan memproses refund secara manual.
          </p>
        )}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {cancellable && (
          <button
            onClick={cancel}
            disabled={busy}
            className="mt-6 text-sm text-red-600 hover:underline disabled:opacity-50"
          >
            Batalkan booking
          </button>
        )}
      </div>
      {cancellable && <SharePanel booking={booking} onChange={setBooking} />}
    </div>
  );
}

export default function BookingDetailPage() {
  return (
    <RequireRole roles={['USER']}>
      <BookingDetail />
    </RequireRole>
  );
}
