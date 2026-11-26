'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatDateTime, formatRupiah } from '@/lib/format';
import type { CrisisInfo, Recommendation } from '@/lib/types';

export function CrisisPanel({ crisis }: { crisis: CrisisInfo }) {
  const [available, setAvailable] = useState<Recommendation[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadAvailable() {
    setLoading(true);
    try {
      setAvailable((await api<{ items: Recommendation[] }>('/psychologists/available-now')).items);
    } catch {
      setAvailable([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section role="alert" className="rounded-xl border-2 border-red-300 bg-red-50 p-5">
      <p className="text-sm text-red-900">{crisis.message}</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {crisis.contacts.map((c) => (
          <a
            key={c.phone}
            href={c.tel}
            className="flex flex-col rounded-lg bg-red-600 px-4 py-3 text-white hover:bg-red-700"
          >
            <span className="text-xs">{c.label}</span>
            <span className="text-xl font-bold">
              {c.phone}
              {c.extension && ` ext. ${c.extension}`}
            </span>
          </a>
        ))}
      </div>
      <p className="mt-3 text-xs text-red-800">
        Jika Anda dalam bahaya langsung, segera hubungi 112 atau datangi IGD rumah sakit terdekat, dan beri tahu orang
        yang Anda percaya.
      </p>

      <button
        onClick={loadAvailable}
        disabled={loading}
        className="mt-4 w-full rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-100"
      >
        {loading ? 'Mencari...' : 'Booking sesi segera dengan psikolog'}
      </button>

      {available && (
        <ul className="mt-3 space-y-2">
          {available.length === 0 && (
            <li className="text-sm text-red-800">
              Belum ada psikolog dengan jadwal dalam 24 jam ke depan. Mohon hubungi hotline di atas.
            </li>
          )}
          {available.map((p) => (
            <li key={p.id}>
              <Link
                href={`/psychologists/${p.id}`}
                className="flex justify-between rounded-lg bg-white px-3 py-2 text-sm hover:bg-red-100"
              >
                <span>
                  <strong>{p.fullName}</strong> · {formatRupiah(p.pricePerSession)}
                </span>
                {p.nextSlot && <span className="text-slate-600">{formatDateTime(p.nextSlot.startAt)}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
