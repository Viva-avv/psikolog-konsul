'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { SelfTestResultView } from '@/components/SelfTestResult';
import { SelfTestRunner } from '@/components/SelfTestRunner';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useConsents } from '@/lib/use-consents';
import type { SelfTest, SelfTestOutcome } from '@/lib/types';

function SaveNotice() {
  const { user } = useAuth();
  const isUser = user?.role === 'USER';
  const { has, grant, loading } = useConsents(isUser);

  if (!user) {
    return (
      <p className="text-sm text-slate-600">
        Hasil tidak akan disimpan karena kamu belum masuk.{' '}
        <Link href="/login" className="text-teal-700 underline">
          Masuk
        </Link>{' '}
        untuk menyimpan hasil dan mendapatkan penjelasan AI.
      </p>
    );
  }
  if (!isUser) return <p className="text-sm text-slate-600">Hasil tidak disimpan untuk akun psikolog atau admin.</p>;
  if (loading) return null;

  const canSave = has('STORE_ASSESSMENT');
  return (
    <label className="flex items-start gap-2 text-sm">
      <input
        type="checkbox"
        checked={canSave}
        disabled={canSave}
        onChange={() => grant('STORE_ASSESSMENT')}
        className="mt-1"
      />
      <span>
        Simpan hasil tes saya (terenkripsi). Hanya skor akhir yang disimpan, bukan jawaban per pertanyaan. Dapat dicabut
        di{' '}
        <Link href="/settings/privacy" className="text-teal-700 underline">
          Pengaturan privasi
        </Link>
        .
      </span>
    </label>
  );
}

export default function SelfTestPage() {
  const { slug } = useParams<{ slug: string }>();
  const [test, setTest] = useState<SelfTest | null>(null);
  const [phase, setPhase] = useState<'intro' | 'quiz' | 'result'>('intro');
  const [attempt, setAttempt] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [outcome, setOutcome] = useState<SelfTestOutcome | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ test: SelfTest }>(`/discover/tests/${slug}`)
      .then((r) => setTest(r.test))
      .catch((err) => setError(err instanceof ApiError && err.status !== 400 ? err.message : 'Tes tidak ditemukan'));
  }, [slug]);

  async function submit(values: number[]) {
    setBusy(true);
    setError(null);
    const send = () => api<SelfTestOutcome>(`/discover/tests/${slug}`, { method: 'POST', body: { answers: values } });
    try {
      let result: SelfTestOutcome;
      try {
        result = await send();
      } catch (err) {
        // An expired session that could not be refreshed: the retry goes out anonymously.
        if (err instanceof ApiError && err.status === 401) result = await send();
        else throw err;
      }
      setAnswers(values);
      setOutcome(result);
      setPhase('result');
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal mengirim jawaban');
    } finally {
      setBusy(false);
    }
  }

  if (error && !test) {
    return (
      <div className="card space-y-2">
        <p className="text-sm text-red-600">{error}</p>
        <Link href="/discover" className="text-sm text-teal-700 underline">
          Kembali ke Temukan Dirimu
        </Link>
      </div>
    );
  }
  if (!test) return <p className="text-sm text-slate-500">Memuat...</p>;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/discover" className="text-sm text-teal-700 hover:underline">
        ← Temukan Dirimu
      </Link>

      {phase === 'intro' && (
        <div className="card space-y-4">
          <div>
            <h1 className="text-2xl font-semibold">{test.title}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {test.itemCount} pertanyaan · ±{test.minutes} menit
            </p>
          </div>
          <p className="text-slate-700">{test.description}</p>
          {test.warning && (
            <p role="note" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {test.warning}
            </p>
          )}
          <SaveNotice />
          <button onClick={() => setPhase('quiz')} className="btn-primary">
            Mulai tes
          </button>
          <p className="text-xs text-slate-500">Sumber: {test.source}</p>
        </div>
      )}

      {phase === 'quiz' && (
        <>
          <SelfTestRunner key={attempt} test={test} busy={busy} onSubmit={submit} onCancel={() => setPhase('intro')} />
          {error && <p className="text-sm text-red-600">{error}</p>}
        </>
      )}

      {phase === 'result' && outcome && (
        <>
          <SelfTestResultView outcome={outcome} answers={answers} />
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => {
                setAttempt((a) => a + 1);
                setOutcome(null);
                setPhase('quiz');
              }}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-white"
            >
              Ulangi tes
            </button>
            <Link href="/discover" className="btn-primary">
              Coba tes lain
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
