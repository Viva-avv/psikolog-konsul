'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { RequireRole } from '@/components/RequireRole';
import { PsychologistNav } from '@/components/PsychologistNav';
import { api, ApiError } from '@/lib/api';
import { formatDate, formatTime } from '@/lib/format';
import type { Slot } from '@/lib/types';

const SLOT_STATUS: Record<NonNullable<Slot['status']>, string> = {
  AVAILABLE: 'border-teal-300 bg-teal-50 text-teal-800',
  HELD: 'border-amber-300 bg-amber-50 text-amber-800',
  BOOKED: 'border-slate-400 bg-slate-200 text-slate-700',
  BLOCKED: 'border-slate-200 bg-slate-50 text-slate-400 line-through',
};

/** Builds consecutive slots in the browser's local timezone. */
function buildSlots(date: string, start: string, duration: number, count: number, gap: number) {
  const first = new Date(`${date}T${start}`);
  return Array.from({ length: count }, (_, i) => {
    const startAt = new Date(first.getTime() + i * (duration + gap) * 60_000);
    return { startAt: startAt.toISOString(), endAt: new Date(startAt.getTime() + duration * 60_000).toISOString() };
  });
}

function Schedule() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<{ items: Slot[] }>('/psychologists/me/slots')
      .then((r) => setSlots(r.items))
      .catch((e: Error) => setMessage({ ok: false, text: e.message }));
  }, []);
  useEffect(load, [load]);

  const byDay = useMemo(() => {
    const groups = new Map<string, Slot[]>();
    for (const s of slots) groups.set(formatDate(s.startAt), [...(groups.get(formatDate(s.startAt)) ?? []), s]);
    return [...groups.entries()];
  }, [slots]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const payload = buildSlots(
      String(f.get('date')),
      String(f.get('start')),
      Number(f.get('duration')),
      Number(f.get('count')),
      Number(f.get('gap')),
    );
    setBusy(true);
    setMessage(null);
    try {
      const r = await api<{ created: number }>('/psychologists/me/slots', { method: 'POST', body: { slots: payload } });
      setMessage({ ok: true, text: `${r.created} slot ditambahkan` });
      load();
    } catch (err) {
      setMessage({ ok: false, text: err instanceof ApiError ? err.message : 'Gagal menambah slot' });
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      await api(`/psychologists/me/slots/${id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setMessage({ ok: false, text: err instanceof ApiError ? err.message : 'Gagal menghapus slot' });
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-[20rem_1fr]">
      <form onSubmit={onSubmit} className="card space-y-3 self-start">
        <h1 className="text-lg font-semibold">Tambah slot</h1>
        <label className="block text-sm">
          Tanggal
          <input name="date" type="date" required className="input mt-1" />
        </label>
        <label className="block text-sm">
          Jam mulai
          <input name="start" type="time" required defaultValue="09:00" className="input mt-1" />
        </label>
        <div className="grid grid-cols-3 gap-2">
          <label className="block text-sm">
            Durasi
            <select name="duration" defaultValue="60" className="input mt-1">
              <option value="45">45 m</option>
              <option value="60">60 m</option>
              <option value="90">90 m</option>
            </select>
          </label>
          <label className="block text-sm">
            Jumlah
            <input name="count" type="number" min={1} max={10} defaultValue={3} className="input mt-1" />
          </label>
          <label className="block text-sm">
            Jeda
            <select name="gap" defaultValue="15" className="input mt-1">
              <option value="0">0 m</option>
              <option value="10">10 m</option>
              <option value="15">15 m</option>
              <option value="30">30 m</option>
            </select>
          </label>
        </div>
        {message && <p className={`text-sm ${message.ok ? 'text-teal-700' : 'text-red-600'}`}>{message.text}</p>}
        <button type="submit" disabled={busy} className="btn-primary w-full">
          Tambah
        </button>
      </form>

      <div className="card">
        <h2 className="mb-4 font-semibold">Jadwal 14 hari ke depan</h2>
        {byDay.length === 0 && <p className="text-sm text-slate-500">Belum ada slot.</p>}
        <div className="space-y-4">
          {byDay.map(([day, items]) => (
            <div key={day}>
              <p className="mb-2 text-sm font-medium">{day}</p>
              <div className="flex flex-wrap gap-2">
                {items.map((s) => (
                  <span
                    key={s.id}
                    className={`inline-flex items-center gap-2 rounded-lg border px-2 py-1 text-xs ${SLOT_STATUS[s.status!]}`}
                  >
                    {formatTime(s.startAt)}–{formatTime(s.endAt)}
                    {s.status === 'AVAILABLE' && (
                      <button onClick={() => remove(s.id)} aria-label="Hapus slot" className="hover:text-red-600">
                        ×
                      </button>
                    )}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function SchedulePage() {
  return (
    <RequireRole roles={['PSYCHOLOGIST']}>
      <PsychologistNav />
      <Schedule />
    </RequireRole>
  );
}
