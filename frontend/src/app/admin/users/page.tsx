'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { RequireRole } from '@/components/RequireRole';
import { AdminNav, Pager } from '@/components/AdminNav';
import { api, ApiError, type Role } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import type { Paginated } from '@/lib/types';

interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
}

function Users() {
  const [filters, setFilters] = useState({ q: '', role: '', status: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<AdminUser> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    const params = new URLSearchParams({ page: String(page) });
    Object.entries(filters).forEach(([k, v]) => v && params.set(k, v));
    api<Paginated<AdminUser>>(`/admin/users?${params}`)
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [filters, page]);
  useEffect(load, [load]);

  function onSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setPage(1);
    setFilters({ q: String(f.get('q') ?? ''), role: String(f.get('role') ?? ''), status: String(f.get('status') ?? '') });
  }

  async function toggle(u: AdminUser) {
    const next = u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    if (next === 'SUSPENDED' && !confirm(`Tangguhkan ${u.email}? Semua sesi login akan dicabut.`)) return;
    try {
      await api(`/admin/users/${u.id}/status`, { method: 'PATCH', body: { status: next } });
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Gagal mengubah status');
    }
  }

  return (
    <div className="card">
      <form onSubmit={onSearch} className="mb-4 flex flex-wrap gap-2">
        <input name="q" placeholder="Cari nama/email" maxLength={100} className="input max-w-xs" />
        <select name="role" className="input max-w-40">
          <option value="">Semua role</option>
          <option value="USER">USER</option>
          <option value="PSYCHOLOGIST">PSYCHOLOGIST</option>
          <option value="ADMIN">ADMIN</option>
        </select>
        <select name="status" className="input max-w-40">
          <option value="">Semua status</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="SUSPENDED">SUSPENDED</option>
        </select>
        <button className="btn-primary">Cari</button>
      </form>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-slate-500">
            <tr>
              <th className="py-2">Nama</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Terdaftar</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data?.items.map((u) => (
              <tr key={u.id} className="border-t border-slate-100">
                <td className="py-2">{u.fullName}</td>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td className={u.status === 'SUSPENDED' ? 'text-red-600' : ''}>{u.status}</td>
                <td>{formatDateTime(u.createdAt)}</td>
                <td className="text-right">
                  {u.role !== 'ADMIN' && (
                    <button onClick={() => toggle(u)} className="text-teal-700 hover:underline">
                      {u.status === 'ACTIVE' ? 'Tangguhkan' : 'Aktifkan'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data && <Pager page={data.page} pageSize={data.pageSize} total={data.total} onChange={setPage} />}
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <RequireRole roles={['ADMIN']}>
      <AdminNav />
      <Users />
    </RequireRole>
  );
}
