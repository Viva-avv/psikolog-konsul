'use client';

import { useCallback, useEffect, useState } from 'react';
import { RequireRole } from '@/components/RequireRole';
import { AdminNav } from '@/components/AdminNav';
import { api, apiBlob, ApiError } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import type { Paginated, VerificationDocument, VerificationStatus } from '@/lib/types';

interface Applicant {
  id: string;
  fullName: string;
  email: string;
  title: string | null;
  yearsExperience: number;
  verificationStatus: VerificationStatus;
  createdAt: string;
  documents: VerificationDocument[];
}

async function openDocument(id: string) {
  const blob = await apiBlob(`/admin/documents/${id}/file`);
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function ApplicantCard({ a, onDone }: { a: Applicant; onDone: () => void }) {
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function decide(kind: 'verify' | 'reject') {
    setBusy(true);
    setError(null);
    try {
      await api(`/admin/psychologists/${a.id}/${kind}`, {
        method: 'POST',
        body: kind === 'reject' ? { note } : undefined,
      });
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Gagal memproses');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="flex flex-wrap justify-between gap-2">
        <div>
          <h2 className="font-semibold">{a.fullName}</h2>
          <p className="text-sm text-slate-500">
            {a.email} · {a.title ?? 'tanpa gelar'} · {a.yearsExperience} th
          </p>
        </div>
        <span className="text-xs text-slate-500">Daftar {formatDateTime(a.createdAt)}</span>
      </div>

      <ul className="mt-4 space-y-2 text-sm">
        {a.documents.length === 0 && <li className="text-slate-500">Belum mengunggah dokumen.</li>}
        {a.documents.map((d) => (
          <li key={d.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
            <span>
              <strong>{d.type}</strong> · {d.number}
              {d.expiresAt && ` · s.d. ${formatDateTime(d.expiresAt)}`} · <em>{d.status}</em>
            </span>
            <button
              onClick={() => openDocument(d.id).catch(() => setError('Gagal membuka dokumen'))}
              className="text-teal-700 hover:underline"
            >
              Lihat
            </button>
          </li>
        ))}
      </ul>

      {a.verificationStatus === 'PENDING' && (
        <div className="mt-4 space-y-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            placeholder="Alasan penolakan (wajib jika menolak)"
            className="input"
          />
          <div className="flex gap-2">
            <button onClick={() => decide('verify')} disabled={busy} className="btn-primary">
              Verifikasi
            </button>
            <button
              onClick={() => decide('reject')}
              disabled={busy || note.trim().length < 5}
              className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-700 disabled:opacity-50"
            >
              Tolak
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}

function VerificationQueue() {
  const [status, setStatus] = useState<VerificationStatus>('PENDING');
  const [data, setData] = useState<Paginated<Applicant> | null>(null);

  const load = useCallback(() => {
    api<Paginated<Applicant>>(`/admin/psychologists?status=${status}`).then(setData);
  }, [status]);
  useEffect(load, [load]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Verifikasi psikolog</h1>
        <select value={status} onChange={(e) => setStatus(e.target.value as VerificationStatus)} className="input max-w-48">
          <option value="PENDING">Menunggu</option>
          <option value="VERIFIED">Terverifikasi</option>
          <option value="REJECTED">Ditolak</option>
        </select>
      </div>
      {data?.items.length === 0 && <p className="text-sm text-slate-500">Tidak ada data.</p>}
      <div className="space-y-4">
        {data?.items.map((a) => <ApplicantCard key={a.id} a={a} onDone={load} />)}
      </div>
    </div>
  );
}

export default function AdminVerificationPage() {
  return (
    <RequireRole roles={['ADMIN']}>
      <AdminNav />
      <VerificationQueue />
    </RequireRole>
  );
}
