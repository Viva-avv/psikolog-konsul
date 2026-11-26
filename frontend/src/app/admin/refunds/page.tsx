'use client';

import { useCallback, useEffect, useState } from 'react';
import { RequireRole } from '@/components/RequireRole';
import { AdminNav, Pager } from '@/components/AdminNav';
import { api, ApiError } from '@/lib/api';
import { formatDateTime, formatRupiah } from '@/lib/format';
import type { Paginated } from '@/lib/types';

interface Refund {
  id: string;
  orderId: string;
  amount: number;
  paymentType: string | null;
  midtransTransactionId: string | null;
  paidAt: string | null;
  booking: { id: string; status: string; user: { fullName: string; email: string } };
}

function Refunds() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<Refund> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api<Paginated<Refund>>(`/admin/refunds?page=${page}`).then(setData);
  }, [page]);
  useEffect(load, [load]);

  async function markDone(r: Refund) {
    if (!confirm(`Tandai ${r.orderId} sudah direfund melalui dashboard Midtrans?`)) return;
    try {
      await api(`/admin/payments/${r.id}/mark-refunded`, { method: 'POST' });
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Gagal');
    }
  }

  return (
    <div className="card">
      <h1 className="text-lg font-semibold">Refund tertunda</h1>
      <p className="mb-4 text-xs text-slate-500">
        Proses refund di dashboard Midtrans, lalu tandai selesai di sini.
      </p>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      {data?.items.length === 0 && <p className="text-sm text-slate-500">Tidak ada refund tertunda.</p>}
      <ul className="space-y-2 text-sm">
        {data?.items.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3">
            <div>
              <p className="font-medium">
                {r.orderId} · {formatRupiah(r.amount)} · {r.paymentType ?? '-'}
              </p>
              <p className="text-slate-500">
                {r.booking.user.fullName} ({r.booking.user.email}) · booking {r.booking.status} · dibayar{' '}
                {r.paidAt ? formatDateTime(r.paidAt) : '-'}
              </p>
            </div>
            <button onClick={() => markDone(r)} className="btn-primary">
              Tandai sudah direfund
            </button>
          </li>
        ))}
      </ul>
      {data && <Pager page={data.page} pageSize={data.pageSize} total={data.total} onChange={setPage} />}
    </div>
  );
}

export default function AdminRefundsPage() {
  return (
    <RequireRole roles={['ADMIN']}>
      <AdminNav />
      <Refunds />
    </RequireRole>
  );
}
