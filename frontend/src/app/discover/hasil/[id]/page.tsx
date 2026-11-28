'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { RequireRole } from '@/components/RequireRole';
import { SelfTestResultView } from '@/components/SelfTestResult';
import { api, ApiError } from '@/lib/api';
import type { SelfTestOutcome } from '@/lib/types';

function StoredResult() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [outcome, setOutcome] = useState<SelfTestOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<SelfTestOutcome>(`/discover/results/${id}`)
      .then(setOutcome)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Gagal memuat hasil'));
  }, [id]);

  async function remove() {
    if (!confirm('Hapus hasil tes ini secara permanen?')) return;
    try {
      await api(`/discover/results/${id}`, { method: 'DELETE' });
      router.push('/discover');
    } catch {
      setError('Gagal menghapus hasil');
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/discover" className="text-sm text-teal-700 hover:underline">
        ← Temukan Dirimu
      </Link>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!outcome && !error && <p className="text-sm text-slate-500">Memuat...</p>}
      {outcome && (
        <>
          <SelfTestResultView outcome={outcome} />
          <div className="flex flex-wrap gap-3">
            <Link href={`/discover/${outcome.slug}`} className="btn-primary">
              Ulangi tes
            </Link>
            <button onClick={remove} className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-700 hover:bg-red-50">
              Hapus hasil ini
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function StoredResultPage() {
  return (
    <RequireRole roles={['USER']}>
      <StoredResult />
    </RequireRole>
  );
}
