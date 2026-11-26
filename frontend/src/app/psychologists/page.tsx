'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatRupiah } from '@/lib/format';
import type { Paginated, Psychologist, Specialization } from '@/lib/types';

export default function PsychologistListPage() {
  const [specs, setSpecs] = useState<Specialization[]>([]);
  const [filter, setFilter] = useState('');
  const [data, setData] = useState<Paginated<Psychologist> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ items: Specialization[] }>('/specializations').then((r) => setSpecs(r.items)).catch(() => undefined);
  }, []);

  useEffect(() => {
    const qs = filter ? `?specialization=${encodeURIComponent(filter)}` : '';
    api<Paginated<Psychologist>>(`/psychologists${qs}`)
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [filter]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Psikolog terverifikasi</h1>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="input max-w-xs">
          <option value="">Semua spesialisasi</option>
          {specs.map((s) => (
            <option key={s.id} value={s.slug}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {data && data.items.length === 0 && <p className="text-sm text-slate-500">Belum ada psikolog yang sesuai.</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        {data?.items.map((p) => (
          <Link key={p.id} href={`/psychologists/${p.id}`} className="card block hover:border-teal-600">
            <h2 className="font-semibold">{p.fullName}</h2>
            {p.title && <p className="text-sm text-slate-500">{p.title}</p>}
            <p className="mt-2 text-sm text-slate-600">
              {p.yearsExperience} tahun pengalaman · {formatRupiah(p.pricePerSession)}/sesi
            </p>
            <div className="mt-3 flex flex-wrap gap-1">
              {p.specializations.map((s) => (
                <span key={s.id} className="rounded-full bg-teal-50 px-2 py-0.5 text-xs text-teal-800">
                  {s.name}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
