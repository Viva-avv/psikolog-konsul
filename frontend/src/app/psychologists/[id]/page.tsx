'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDate, formatRupiah, formatTime } from '@/lib/format';
import type { Booking, Psychologist, Slot } from '@/lib/types';

export default function PsychologistDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [psy, setPsy] = useState<Psychologist | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<'VIDEO' | 'CHAT'>('VIDEO');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api<{ psychologist: Psychologist }>(`/psychologists/${id}`)
      .then((r) => setPsy(r.psychologist))
      .catch((e: Error) => setError(e.message));
    api<{ items: Slot[] }>(`/psychologists/${id}/slots`)
      .then((r) => setSlots(r.items))
      .catch(() => undefined);
  }, [id]);

  const slotsByDay = useMemo(() => {
    const groups = new Map<string, Slot[]>();
    for (const s of slots) {
      const day = formatDate(s.startAt);
      groups.set(day, [...(groups.get(day) ?? []), s]);
    }
    return [...groups.entries()];
  }, [slots]);

  async function book() {
    if (!user) return router.push('/login');
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const { booking } = await api<{ booking: Booking }>('/bookings', {
        method: 'POST',
        body: { slotId: selected, mode },
      });
      router.push(`/bookings/${booking.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Gagal membuat booking');
      if (e instanceof ApiError && e.status === 409) setSlots((prev) => prev.filter((s) => s.id !== selected));
    } finally {
      setSubmitting(false);
    }
  }

  if (error && !psy) return <p className="text-sm text-red-600">{error}</p>;
  if (!psy) return <p className="text-sm text-slate-500">Memuat...</p>;

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_1.2fr]">
      <div className="card">
        <h1 className="text-xl font-semibold">{psy.fullName}</h1>
        {psy.title && <p className="text-sm text-slate-500">{psy.title}</p>}
        <p className="mt-2 text-sm">
          {psy.yearsExperience} tahun pengalaman · <strong>{formatRupiah(psy.pricePerSession)}</strong>/sesi
        </p>
        <div className="mt-3 flex flex-wrap gap-1">
          {psy.specializations.map((s) => (
            <span key={s.id} className="rounded-full bg-teal-50 px-2 py-0.5 text-xs text-teal-800">
              {s.name}
            </span>
          ))}
        </div>
        {psy.bio && <p className="mt-4 whitespace-pre-line text-sm text-slate-700">{psy.bio}</p>}
      </div>

      <div className="card">
        <h2 className="mb-4 font-semibold">Pilih jadwal (WIB)</h2>
        {slotsByDay.length === 0 && <p className="text-sm text-slate-500">Belum ada jadwal tersedia.</p>}
        <div className="space-y-4">
          {slotsByDay.map(([day, items]) => (
            <div key={day}>
              <p className="mb-2 text-sm font-medium text-slate-700">{day}</p>
              <div className="flex flex-wrap gap-2">
                {items.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSelected(s.id)}
                    className={`rounded-lg border px-3 py-1.5 text-sm ${
                      selected === s.id ? 'border-teal-700 bg-teal-700 text-white' : 'border-slate-300 hover:border-teal-600'
                    }`}
                  >
                    {formatTime(s.startAt)}–{formatTime(s.endAt)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {slots.length > 0 && (
          <>
            <div className="mt-6 flex gap-4 text-sm">
              {(['VIDEO', 'CHAT'] as const).map((m) => (
                <label key={m} className="flex items-center gap-2">
                  <input type="radio" checked={mode === m} onChange={() => setMode(m)} />
                  {m === 'VIDEO' ? 'Video call' : 'Chat'}
                </label>
              ))}
            </div>
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            {user && user.role !== 'USER' ? (
              <p className="mt-4 text-sm text-slate-500">Hanya akun pengguna yang dapat melakukan booking.</p>
            ) : (
              <button onClick={book} disabled={!selected || submitting} className="btn-primary mt-4 w-full">
                {submitting ? 'Memproses...' : user ? 'Booking sesi' : 'Masuk untuk booking'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
