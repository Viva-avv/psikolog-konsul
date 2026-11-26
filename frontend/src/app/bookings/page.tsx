'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RequireRole } from '@/components/RequireRole';
import { StatusBadge } from '@/components/StatusBadge';
import { api } from '@/lib/api';
import { formatDateTime, formatRupiah } from '@/lib/format';
import type { Booking, Paginated } from '@/lib/types';

function BookingList() {
  const [items, setItems] = useState<Booking[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Paginated<Booking>>('/bookings')
      .then((r) => setItems(r.items))
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!items) return <p className="text-sm text-slate-500">Memuat...</p>;
  if (items.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Belum ada sesi.{' '}
        <Link href="/psychologists" className="text-teal-700 hover:underline">
          Cari psikolog
        </Link>
      </p>
    );
  }
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((b) => (
        <li key={b.id}>
          <Link href={`/bookings/${b.id}`} className="flex items-center justify-between py-3 hover:bg-slate-50">
            <div>
              <p className="font-medium">{b.psychologist.fullName}</p>
              <p className="text-sm text-slate-500">
                {formatDateTime(b.startAt)} · {b.mode === 'VIDEO' ? 'Video' : 'Chat'} · {formatRupiah(b.price)}
              </p>
            </div>
            <StatusBadge status={b.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function BookingsPage() {
  return (
    <RequireRole roles={['USER']}>
      <div className="card">
        <h1 className="mb-4 text-xl font-semibold">Riwayat sesi</h1>
        <BookingList />
      </div>
    </RequireRole>
  );
}
