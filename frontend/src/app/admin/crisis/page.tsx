'use client';

import { useCallback, useEffect, useState } from 'react';
import { RequireRole } from '@/components/RequireRole';
import { AdminNav, Pager } from '@/components/AdminNav';
import { api, ApiError } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import type { Paginated } from '@/lib/types';

type IncidentStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';

interface Incident {
  id: string;
  userId: string | null;
  source: 'AI_CHAT' | 'ASSESSMENT';
  trigger: string;
  category: string;
  riskLevel: 'MEDIUM' | 'HIGH';
  status: IncidentStatus;
  createdAt: string;
  handledBy: { fullName: string } | null;
}

const STATUS_STYLE: Record<IncidentStatus, string> = {
  OPEN: 'bg-red-100 text-red-700',
  ACKNOWLEDGED: 'bg-amber-100 text-amber-800',
  RESOLVED: 'bg-slate-100 text-slate-600',
};

function IncidentRow({ incident, onChange }: { incident: Incident; onChange: () => void }) {
  const [contact, setContact] = useState<{ fullName: string; email: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reveal() {
    if (!confirm('Tampilkan kontak pengguna? Tindakan ini dicatat di audit log.')) return;
    try {
      setContact(
        (await api<{ contact: { fullName: string; email: string } }>(`/admin/crisis-incidents/${incident.id}/reveal-contact`, {
          method: 'POST',
        })).contact,
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Gagal');
    }
  }

  async function setStatus(status: 'ACKNOWLEDGED' | 'RESOLVED') {
    await api(`/admin/crisis-incidents/${incident.id}`, { method: 'PATCH', body: { status } });
    onChange();
  }

  return (
    <li className="rounded-lg border border-slate-200 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[incident.status]}`}>
            {incident.status}
          </span>
          <span className={`font-semibold ${incident.riskLevel === 'HIGH' ? 'text-red-700' : 'text-amber-700'}`}>
            {incident.riskLevel}
          </span>
          <span className="text-slate-600">
            {incident.category} · {incident.source} · {incident.trigger}
          </span>
        </div>
        <span className="text-xs text-slate-500">{formatDateTime(incident.createdAt)}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        {incident.userId && !contact && (
          <button onClick={reveal} className="text-teal-700 hover:underline">
            Tampilkan kontak
          </button>
        )}
        {contact && (
          <span>
            {contact.fullName} · <a href={`mailto:${contact.email}`} className="text-teal-700 underline">{contact.email}</a>
          </span>
        )}
        {incident.status === 'OPEN' && (
          <button onClick={() => setStatus('ACKNOWLEDGED')} className="text-amber-700 hover:underline">
            Tandai ditangani
          </button>
        )}
        {incident.status !== 'RESOLVED' && (
          <button onClick={() => setStatus('RESOLVED')} className="text-slate-600 hover:underline">
            Selesai
          </button>
        )}
        {incident.handledBy && <span className="text-xs text-slate-500">oleh {incident.handledBy.fullName}</span>}
        {error && <span className="text-red-600">{error}</span>}
      </div>
    </li>
  );
}

function CrisisLog() {
  const [status, setStatus] = useState<IncidentStatus | ''>('OPEN');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<Incident> | null>(null);

  const load = useCallback(() => {
    const params = new URLSearchParams({ page: String(page) });
    if (status) params.set('status', status);
    api<Paginated<Incident>>(`/admin/crisis-incidents?${params}`).then(setData);
  }, [status, page]);
  useEffect(load, [load]);

  return (
    <div className="card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">Log insiden krisis</h1>
          <p className="text-xs text-slate-500">Isi percakapan tidak pernah disimpan di log ini.</p>
        </div>
        <select
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value as IncidentStatus | '');
          }}
          className="input max-w-48"
        >
          <option value="OPEN">Terbuka</option>
          <option value="ACKNOWLEDGED">Ditangani</option>
          <option value="RESOLVED">Selesai</option>
          <option value="">Semua</option>
        </select>
      </div>
      {data?.items.length === 0 && <p className="text-sm text-slate-500">Tidak ada insiden.</p>}
      <ul className="space-y-2">
        {data?.items.map((i) => <IncidentRow key={i.id} incident={i} onChange={load} />)}
      </ul>
      {data && <Pager page={data.page} pageSize={data.pageSize} total={data.total} onChange={setPage} />}
    </div>
  );
}

export default function AdminCrisisPage() {
  return (
    <RequireRole roles={['ADMIN']}>
      <AdminNav />
      <CrisisLog />
    </RequireRole>
  );
}
