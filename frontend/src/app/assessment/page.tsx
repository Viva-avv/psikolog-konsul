'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { RequireRole } from '@/components/RequireRole';
import { AiDisclaimer } from '@/components/AiDisclaimer';
import { CrisisPanel } from '@/components/CrisisPanel';
import { api, ApiError } from '@/lib/api';
import { useConsents } from '@/lib/use-consents';
import { formatDateTime, formatRupiah } from '@/lib/format';
import type { AssessmentSummary, CrisisInfo, Recommendation } from '@/lib/types';

type QType = 'PHQ9' | 'GAD7';

interface Questionnaire {
  type: QType;
  title: string;
  prompt: string;
  items: string[];
  options: Array<{ value: number; label: string }>;
}

interface AssessmentResult {
  type: QType;
  score: number;
  maxScore: number;
  severity: string;
  saved: boolean;
  crisis?: CrisisInfo;
}

type SummaryResult =
  | { type: 'SUMMARY'; summary: AssessmentSummary; recommendations: Recommendation[] }
  | { type: 'CRISIS'; crisis: CrisisInfo };

function QuestionnaireForm({ onDone }: { onDone: (r: AssessmentResult) => void }) {
  const [q, setQ] = useState<Questionnaire | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load(type: QType) {
    const r = await api<{ questionnaire: Questionnaire }>(`/assessments/questionnaires/${type}`);
    setQ(r.questionnaire);
    setAnswers(Array(r.questionnaire.items.length).fill(-1));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!q || answers.some((a) => a < 0)) return setError('Mohon jawab semua pertanyaan');
    try {
      onDone(await api<AssessmentResult>('/assessments', { method: 'POST', body: { type: q.type, answers } }));
      setQ(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal mengirim jawaban');
    }
  }

  if (!q) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <button onClick={() => load('PHQ9')} className="card text-left hover:border-teal-600">
          <strong>PHQ-9</strong>
          <p className="text-sm text-slate-600">9 pertanyaan tentang suasana hati dan minat.</p>
        </button>
        <button onClick={() => load('GAD7')} className="card text-left hover:border-teal-600">
          <strong>GAD-7</strong>
          <p className="text-sm text-slate-600">7 pertanyaan tentang rasa cemas dan khawatir.</p>
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card space-y-5">
      <div>
        <h2 className="font-semibold">{q.title}</h2>
        <p className="text-sm text-slate-600">{q.prompt}</p>
      </div>
      {q.items.map((item, i) => (
        <fieldset key={i} className="space-y-2">
          <legend className="text-sm font-medium">
            {i + 1}. {item}
          </legend>
          <div className="grid gap-1 sm:grid-cols-4">
            {q.options.map((o) => (
              <label
                key={o.value}
                className={`cursor-pointer rounded-lg border px-2 py-1.5 text-center text-xs ${
                  answers[i] === o.value ? 'border-teal-700 bg-teal-50 text-teal-800' : 'border-slate-200'
                }`}
              >
                <input
                  type="radio"
                  name={`q${i}`}
                  className="sr-only"
                  checked={answers[i] === o.value}
                  onChange={() => setAnswers((prev) => prev.map((a, j) => (j === i ? o.value : a)))}
                />
                {o.label}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" className="btn-primary">
          Lihat hasil
        </button>
        <button type="button" onClick={() => setQ(null)} className="text-sm text-slate-600">
          Batal
        </button>
      </div>
    </form>
  );
}

function SummaryForm({ canUseAi, onGrant }: { canUseAi: boolean; onGrant: () => Promise<void> }) {
  const [complaint, setComplaint] = useState('');
  const [result, setResult] = useState<SummaryResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setResult(await api<SummaryResult>('/assessments/summaries', { method: 'POST', body: { complaint } }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal membuat ringkasan');
    } finally {
      setBusy(false);
    }
  }

  if (!canUseAi) {
    return (
      <div className="card space-y-3">
        <h2 className="font-semibold">Ringkasan untuk psikolog</h2>
        <p className="text-sm text-slate-600">
          Fitur ini memakai AI untuk merangkum keluhan Anda dan menyimpan ringkasannya (terenkripsi). Ringkasan hanya
          dibagikan ke psikolog jika Anda memilihnya di halaman booking.
        </p>
        <button onClick={onGrant} className="btn-primary">
          Setuju dan aktifkan
        </button>
      </div>
    );
  }

  if (result?.type === 'CRISIS') return <CrisisPanel crisis={result.crisis} />;

  if (result?.type === 'SUMMARY') {
    const s = result.summary;
    return (
      <div className="space-y-4">
        <div className="card space-y-2 text-sm">
          <h2 className="font-semibold">Ringkasan tersimpan</h2>
          <p>
            <strong>Keluhan utama:</strong> {s.chiefComplaint}
          </p>
          {s.keyThemes.length > 0 && (
            <p>
              <strong>Tema:</strong> {s.keyThemes.join(', ')}
            </p>
          )}
          {s.duration && (
            <p>
              <strong>Durasi:</strong> {s.duration}
            </p>
          )}
          {s.functionalImpact && (
            <p>
              <strong>Dampak:</strong> {s.functionalImpact}
            </p>
          )}
          <p className="text-xs text-slate-500">
            Ringkasan ini bukan diagnosis. Bagikan ke psikolog dari halaman detail booking.
          </p>
        </div>
        <div className="card">
          <h2 className="mb-3 font-semibold">Psikolog yang mungkin sesuai</h2>
          <ul className="space-y-2">
            {result.recommendations.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/psychologists/${p.id}`}
                  className="flex justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm hover:border-teal-600"
                >
                  <span>
                    <strong>{p.fullName}</strong> · {p.specializations.map((x) => x.name).join(', ')}
                  </span>
                  <span className="text-slate-500">
                    {p.nextSlot ? formatDateTime(p.nextSlot.startAt) : 'Belum ada jadwal'} · {formatRupiah(p.pricePerSession)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card space-y-3">
      <h2 className="font-semibold">Ringkasan untuk psikolog</h2>
      <p className="text-sm text-slate-600">
        Ceritakan singkat apa yang Anda alami, sejak kapan, dan apa yang ingin Anda capai. Hindari menulis nama atau data
        identitas.
      </p>
      <textarea
        value={complaint}
        onChange={(e) => setComplaint(e.target.value)}
        minLength={10}
        maxLength={2000}
        rows={6}
        required
        className="input"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={busy || complaint.trim().length < 10} className="btn-primary">
        {busy ? 'Menyusun ringkasan...' : 'Buat ringkasan & rekomendasi'}
      </button>
    </form>
  );
}

function Assessment() {
  const { has, loading, grant } = useConsents();
  const [result, setResult] = useState<AssessmentResult | null>(null);

  if (loading) return <p className="text-sm text-slate-500">Memuat...</p>;
  const canSave = has('STORE_ASSESSMENT');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Pra-asesmen</h1>
        <p className="mt-1 text-sm text-slate-600">
          Kuesioner skrining singkat untuk membantu Anda dan psikolog memahami kondisi Anda. Hasilnya{' '}
          <strong>bukan diagnosis</strong>.
        </p>
      </div>
      <AiDisclaimer />

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={canSave}
          onChange={() => (canSave ? undefined : grant('STORE_ASSESSMENT'))}
          disabled={canSave}
          className="mt-1"
        />
        <span>
          Simpan hasil asesmen saya (terenkripsi). Dapat dicabut kapan saja di{' '}
          <Link href="/settings/privacy" className="text-teal-700 underline">
            Pengaturan privasi
          </Link>
          ; mencabut akan menghapus semua hasil tersimpan.
        </span>
      </label>

      {result ? (
        <div className="space-y-4">
          {result.crisis && <CrisisPanel crisis={result.crisis} />}
          <div className="card">
            <p className="text-sm text-slate-500">{result.type === 'PHQ9' ? 'PHQ-9' : 'GAD-7'}</p>
            <p className="text-3xl font-bold">
              {result.score}
              <span className="text-base font-normal text-slate-500"> / {result.maxScore}</span>
            </p>
            <p className="mt-1">
              Tingkat gejala: <strong>{result.severity}</strong>
            </p>
            <p className="mt-2 text-xs text-slate-500">
              {result.saved ? 'Hasil tersimpan.' : 'Hasil tidak disimpan.'} Skor ini adalah skrining, bukan diagnosis.
            </p>
            <button onClick={() => setResult(null)} className="mt-3 text-sm text-teal-700 hover:underline">
              Isi kuesioner lain
            </button>
          </div>
        </div>
      ) : (
        <QuestionnaireForm onDone={setResult} />
      )}

      <SummaryForm
        canUseAi={has('AI_PROCESSING') && canSave}
        onGrant={async () => {
          if (!has('AI_PROCESSING')) await grant('AI_PROCESSING');
          if (!canSave) await grant('STORE_ASSESSMENT');
        }}
      />
    </div>
  );
}

export default function AssessmentPage() {
  return (
    <RequireRole roles={['USER']}>
      <Assessment />
    </RequireRole>
  );
}
