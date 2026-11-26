'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { RequireRole } from '@/components/RequireRole';
import { AdminNav, Pager } from '@/components/AdminNav';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import type { Paginated } from '@/lib/types';

interface AuditEntry {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: unknown;
  createdAt: string;
  actor: { id: string; email: string; role: string } | null;
}

function AuditLog() {
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<AuditEntry> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: '50' });
    if (action) params.set('action', action);
    api<Paginated<AuditEntry>>(`/admin/audit-logs?${params}`)
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [action, page]);
  useEffect(load, [load]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPage(1);
    setAction(String(new FormData(e.currentTarget).get('action') ?? '').trim().toLowerCase());
  }

  return (
    <div className="card">
      <form onSubmit={onSubmit} className="mb-4 flex gap-2">
        <input name="action" placeholder="Filter aksi, mis. admin. atau summary.read" className="input max-w-sm" />
        <button className="btn-primary">Filter</button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-slate-500">
            <tr>
              <th className="py-2">Waktu</th>
              <th>Aksi</th>
              <th>Pelaku</th>
              <th>Entitas</th>
              <th>Metadata</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {data?.items.map((a) => (
              <tr key={a.id} className="border-t border-slate-100 align-top">
                <td className="py-1.5 pr-2 whitespace-nowrap">{formatDateTime(a.createdAt)}</td>
                <td className="pr-2">{a.action}</td>
                <td className="pr-2">{a.actor ? `${a.actor.email} (${a.actor.role})` : 'sistem'}</td>
                <td className="pr-2">{a.entityType ? `${a.entityType}:${a.entityId?.slice(0, 8)}` : '-'}</td>
                <td className="max-w-xs truncate">{a.metadata ? JSON.stringify(a.metadata) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data && <Pager page={data.page} pageSize={data.pageSize} total={data.total} onChange={setPage} />}
    </div>
  );
}

export default function AdminAuditPage() {
  return (
    <RequireRole roles={['ADMIN']}>
      <AdminNav />
      <AuditLog />
    </RequireRole>
  );
}
