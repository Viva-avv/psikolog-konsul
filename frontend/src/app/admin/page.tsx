'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RequireRole } from '@/components/RequireRole';
import { AdminNav } from '@/components/AdminNav';
import { api } from '@/lib/api';
import { formatRupiah } from '@/lib/format';

interface Summary {
  periodDays: number;
  usersByRole: Record<string, number>;
  psychologistsByVerification: Record<string, number>;
  bookingsByStatus: Record<string, number>;
  revenueSettled: number;
  pendingRefunds: number;
  openCrisisIncidents: number;
  crisisIncidentsByRisk: Record<string, number>;
}

function Stat({ label, value, href, alert }: { label: string; value: string | number; href?: string; alert?: boolean }) {
  const body = (
    <div className={`card ${alert ? 'border-red-300 bg-red-50' : ''}`}>
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${alert ? 'text-red-700' : ''}`}>{value}</p>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function Breakdown({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data);
  return (
    <div className="card">
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      {entries.length === 0 ? (
        <p className="text-sm text-slate-400">Tidak ada data</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {entries.map(([k, v]) => (
            <li key={k} className="flex justify-between">
              <span className="text-slate-600">{k}</span>
              <strong>{v}</strong>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Overview() {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Summary>('/admin/reports/summary')
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <p className="text-sm text-slate-500">Memuat...</p>;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Insiden krisis terbuka"
          value={data.openCrisisIncidents}
          href="/admin/crisis"
          alert={data.openCrisisIncidents > 0}
        />
        <Stat
          label="Menunggu verifikasi"
          value={data.psychologistsByVerification.PENDING ?? 0}
          href="/admin/verification"
        />
        <Stat label="Refund tertunda" value={data.pendingRefunds} href="/admin/refunds" alert={data.pendingRefunds > 0} />
        <Stat label={`Pendapatan ${data.periodDays} hari`} value={formatRupiah(data.revenueSettled)} />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Breakdown title="Pengguna per role" data={data.usersByRole} />
        <Breakdown title={`Booking ${data.periodDays} hari (status)`} data={data.bookingsByStatus} />
        <Breakdown title={`Insiden krisis ${data.periodDays} hari (risiko)`} data={data.crisisIncidentsByRisk} />
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <RequireRole roles={['ADMIN']}>
      <AdminNav />
      <Overview />
    </RequireRole>
  );
}
