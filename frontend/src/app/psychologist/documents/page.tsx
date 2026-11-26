'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { RequireRole } from '@/components/RequireRole';
import { PsychologistNav } from '@/components/PsychologistNav';
import { api, ApiError } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import type { VerificationDocument } from '@/lib/types';

const DOC_STATUS = {
  PENDING: 'text-amber-700',
  APPROVED: 'text-teal-700',
  REJECTED: 'text-red-600',
} as const;

function Documents() {
  const [docs, setDocs] = useState<VerificationDocument[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(() => {
    api<{ items: VerificationDocument[] }>('/psychologists/me/documents').then((r) => setDocs(r.items));
  }, []);
  useEffect(load, [load]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const file = (formEl.elements.namedItem('file') as HTMLInputElement).files?.[0];
    if (file && file.size > 5 * 1024 * 1024) return setError('Ukuran file maksimal 5 MB');
    setUploading(true);
    setError(null);
    try {
      await api('/psychologists/me/documents', { method: 'POST', body: new FormData(formEl) });
      formEl.reset();
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal mengunggah');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <form onSubmit={onSubmit} className="card space-y-4">
        <h1 className="text-xl font-semibold">Unggah dokumen</h1>
        <p className="text-xs text-slate-500">
          STR dan SIPP wajib untuk verifikasi. File disimpan privat dan hanya dapat dilihat admin.
        </p>
        <label className="block text-sm">
          Jenis
          <select name="type" required className="input mt-1">
            <option value="STR">STR (Surat Tanda Registrasi)</option>
            <option value="SIPP">SIPP (Surat Izin Praktik Psikolog)</option>
          </select>
        </label>
        <label className="block text-sm">
          Nomor dokumen
          <input name="number" required minLength={3} maxLength={64} className="input mt-1" />
        </label>
        <label className="block text-sm">
          Berlaku hingga (opsional)
          <input name="expiresAt" type="date" className="input mt-1" />
        </label>
        <label className="block text-sm">
          File (PDF/JPG/PNG, maks. 5 MB)
          <input name="file" type="file" required accept=".pdf,.jpg,.jpeg,.png" className="mt-1 block text-sm" />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={uploading} className="btn-primary">
          {uploading ? 'Mengunggah...' : 'Unggah'}
        </button>
      </form>

      <div className="card">
        <h2 className="mb-4 font-semibold">Dokumen terunggah</h2>
        {docs.length === 0 && <p className="text-sm text-slate-500">Belum ada dokumen.</p>}
        <ul className="space-y-3 text-sm">
          {docs.map((d) => (
            <li key={d.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex justify-between">
                <strong>
                  {d.type} · {d.number}
                </strong>
                <span className={DOC_STATUS[d.status]}>{d.status}</span>
              </div>
              <p className="text-xs text-slate-500">Diunggah {formatDateTime(d.createdAt)}</p>
              {d.reviewNote && <p className="mt-1 text-xs text-red-600">Catatan admin: {d.reviewNote}</p>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function DocumentsPage() {
  return (
    <RequireRole roles={['PSYCHOLOGIST']}>
      <PsychologistNav />
      <Documents />
    </RequireRole>
  );
}
