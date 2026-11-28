'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AiDisclaimer } from '@/components/AiDisclaimer';
import { CrisisPanel } from '@/components/CrisisPanel';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDateTime, formatRupiah } from '@/lib/format';
import { useConsents } from '@/lib/use-consents';
import type {
  BigFiveResult,
  HeartbreakResult,
  LoveLanguageResult,
  Recommendation,
  SelfTestInsight,
  SelfTestOutcome,
  SixteenTypesResult,
  TraumaResult,
} from '@/lib/types';

function Bar({ percent, tone = 'bg-teal-600' }: { percent: number; tone?: string }) {
  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(3, percent)}%` }} />
    </div>
  );
}

function BigFive({ result }: { result: BigFiveResult }) {
  return (
    <ul className="space-y-5">
      {result.traits.map((t) => (
        <li key={t.key}>
          <div className="mb-1 flex items-baseline justify-between text-sm">
            <strong>{t.name}</strong>
            <span className="text-slate-600">
              {t.level} · {t.percent}%
            </span>
          </div>
          <Bar percent={t.percent} />
          <p className="mt-1.5 text-sm text-slate-600">{t.description}</p>
        </li>
      ))}
    </ul>
  );
}

function SixteenTypes({ result }: { result: SixteenTypesResult }) {
  return (
    <div className="space-y-5">
      <div className="text-center">
        <p className="text-4xl font-bold tracking-widest text-teal-800">{result.code}</p>
        <p className="mt-1 font-medium">{result.nickname}</p>
      </div>
      <p className="text-sm text-slate-700">{result.summary}</p>
      <div className="flex flex-wrap gap-2">
        {result.strengths.map((s) => (
          <span key={s} className="rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-800">
            {s}
          </span>
        ))}
      </div>
      <ul className="space-y-3">
        {result.dimensions.map((d) => (
          <li key={d.key} className="text-sm">
            <div className="mb-1 flex justify-between">
              <span className={d.letter === d.left.letter ? 'font-semibold text-teal-800' : 'text-slate-500'}>
                {d.left.letter} · {d.left.name} {d.leftPercent}%
              </span>
              <span className={d.letter === d.right.letter ? 'font-semibold text-teal-800' : 'text-slate-500'}>
                {100 - d.leftPercent}% {d.right.name} · {d.right.letter}
              </span>
            </div>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-amber-200" aria-hidden>
              <div className="h-full bg-teal-600" style={{ width: `${d.leftPercent}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
        <strong>Ruang bertumbuh:</strong> {result.growth}
      </p>
    </div>
  );
}

function Trauma({ result }: { result: TraumaResult }) {
  const { ace, ptsd } = result;
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 p-4">
        <p className="text-sm text-slate-500">Pengalaman sulit masa kecil</p>
        <p className="text-2xl font-bold">
          {ace.score}
          <span className="text-base font-normal text-slate-500"> / {ace.max}</span>
        </p>
        <p className="text-sm font-medium">{ace.band}</p>
        <p className="mt-1 text-sm text-slate-600">{ace.description}</p>
      </div>
      <div className="rounded-lg border border-slate-200 p-4">
        <p className="text-sm text-slate-500">Dampak kejadian traumatis (sebulan terakhir)</p>
        {ptsd.exposure && (
          <p className="text-2xl font-bold">
            {ptsd.score}
            <span className="text-base font-normal text-slate-500"> / {ptsd.max} tanda</span>
          </p>
        )}
        <p className="mt-1 text-sm text-slate-600">{ptsd.description}</p>
      </div>
      <p
        className={`rounded-lg p-3 text-sm ${result.suggestSupport ? 'bg-teal-50 text-teal-900' : 'bg-slate-50 text-slate-700'}`}
      >
        {result.suggestSupport
          ? 'Kamu tidak harus memproses semua ini sendirian. Psikolog yang memahami trauma bisa membantumu memulihkan rasa aman dengan kecepatan yang nyaman bagimu.'
          : 'Jika suatu saat ingatan lama terasa berat, berbicara dengan psikolog bisa membantu.'}{' '}
        Bila mengingat hal-hal ini membuatmu tidak nyaman sekarang, tarik napas perlahan dan hubungi orang yang kamu
        percaya atau <a href="tel:119" className="font-semibold underline">119 ext. 8</a>.
      </p>
    </div>
  );
}

function Heartbreak({ result }: { result: HeartbreakResult }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-2xl font-bold">
          {result.band}
          <span className="ml-2 text-base font-normal text-slate-500">
            {result.score} / {result.max}
          </span>
        </p>
        <div className="mt-2">
          <Bar percent={(result.score / result.max) * 100} tone="bg-rose-500" />
        </div>
        <p className="mt-2 text-sm text-slate-700">{result.description}</p>
      </div>
      {result.areas.length > 0 ? (
        <div>
          <h3 className="mb-2 text-sm font-semibold">Area yang paling terasa & langkah kecil untuk mulai pulih</h3>
          <ul className="space-y-2">
            {result.areas.map((a) => (
              <li key={a.name} className="rounded-lg border border-slate-200 p-3 text-sm">
                <strong>{a.name}</strong>
                <p className="text-slate-600">{a.tip}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-slate-600">Tidak ada area yang terasa sangat berat saat ini.</p>
      )}
    </div>
  );
}

function LoveLanguage({ result }: { result: LoveLanguageResult }) {
  const top = result.ranking.filter((r) => result.primary.includes(r.name));
  return (
    <div className="space-y-5">
      <div className="text-center">
        <p className="text-sm text-slate-500">Bahasa cinta utamamu</p>
        <p className="text-2xl font-bold text-rose-700">{result.primary.join(' & ')}</p>
      </div>
      {top.map((r) => (
        <div key={r.key} className="rounded-lg bg-rose-50 p-4 text-sm text-rose-950">
          <p>{r.description}</p>
          <p className="mt-2">
            <strong>Tips:</strong> {r.tip}
          </p>
        </div>
      ))}
      <ul className="space-y-3">
        {result.ranking.map((r) => (
          <li key={r.key}>
            <div className="mb-1 flex justify-between text-sm">
              <span>{r.name}</span>
              <span className="text-slate-500">
                {r.score}/{r.max}
              </span>
            </div>
            <Bar percent={r.percent} tone="bg-rose-500" />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Insight({ outcome, answers }: { outcome: SelfTestOutcome; answers?: number[] }) {
  const { user } = useAuth();
  const isUser = user?.role === 'USER';
  const { has, grant, loading } = useConsents(isUser);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SelfTestInsight | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (user && !isUser) return null;
  if (!outcome.id && !answers) return null;

  async function request() {
    setBusy(true);
    setError(null);
    try {
      if (!has('AI_PROCESSING')) await grant('AI_PROCESSING');
      const body = outcome.id ? { resultId: outcome.id } : { slug: outcome.slug, answers };
      setResult(await api<SelfTestInsight>('/discover/insight', { method: 'POST', body }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal meminta penjelasan AI');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card space-y-3">
      <h2 className="font-semibold">Penjelasan AI untukmu</h2>
      {!user ? (
        <p className="text-sm text-slate-600">
          <Link href="/login" className="text-teal-700 underline">
            Masuk
          </Link>{' '}
          untuk mendapatkan penjelasan personal dari AI pendamping. Setelah masuk, ulangi tes ini.
        </p>
      ) : result?.type === 'CRISIS' ? (
        <CrisisPanel crisis={result.crisis} />
      ) : result?.type === 'INSIGHT' ? (
        <>
          <div className="space-y-2 text-sm leading-relaxed text-slate-800">
            {result.text.split(/\n{2,}/).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          <AiDisclaimer />
        </>
      ) : (
        <>
          <p className="text-sm text-slate-600">
            AI akan menjelaskan hasilmu dengan bahasa sehari-hari beserta langkah kecil yang bisa dicoba. AI hanya
            menerima skor hasil tes, bukan jawabanmu per pertanyaan.
            {!loading && !has('AI_PROCESSING') &&
              ' Dengan menekan tombol ini, kamu menyetujui hasil tesmu diproses oleh model AI di server platform.'}
          </p>
          <button onClick={request} disabled={busy || loading} className="btn-primary">
            {busy ? 'AI sedang menyusun penjelasan (bisa 1–2 menit)...' : 'Minta penjelasan AI'}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </>
      )}
    </section>
  );
}

function Recommendations({ items }: { items: Recommendation[] }) {
  return (
    <section className="card">
      <h2 className="mb-3 font-semibold">Psikolog yang bisa menemanimu</h2>
      {items.length === 0 ? (
        <p className="text-sm text-slate-600">
          Belum ada rekomendasi yang cocok.{' '}
          <Link href="/psychologists" className="text-teal-700 underline">
            Lihat semua psikolog
          </Link>
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((p) => (
            <li key={p.id}>
              <Link
                href={`/psychologists/${p.id}`}
                className="flex flex-wrap justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:border-teal-600"
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
      )}
    </section>
  );
}

export function SelfTestResultView({ outcome, answers }: { outcome: SelfTestOutcome; answers?: number[] }) {
  return (
    <div className="space-y-6">
      {outcome.crisis && <CrisisPanel crisis={outcome.crisis} />}
      <section className="card space-y-5">
        <div>
          <p className="text-sm text-slate-500">Hasil {outcome.title}</p>
          <h1 className="text-xl font-semibold">{outcome.headline}</h1>
          <p className="mt-1 text-xs text-slate-500">
            {formatDateTime(outcome.createdAt)} · {outcome.saved ? 'Tersimpan (terenkripsi)' : 'Tidak disimpan'}
          </p>
        </div>
        {outcome.type === 'BIG_FIVE' && <BigFive result={outcome.result} />}
        {outcome.type === 'SIXTEEN_TYPES' && <SixteenTypes result={outcome.result} />}
        {outcome.type === 'TRAUMA' && <Trauma result={outcome.result} />}
        {outcome.type === 'HEARTBREAK' && <Heartbreak result={outcome.result} />}
        {outcome.type === 'LOVE_LANGUAGE' && <LoveLanguage result={outcome.result} />}
        <p className="border-t border-slate-100 pt-3 text-xs text-slate-500">
          Hasil ini adalah alat refleksi diri, <strong>bukan diagnosis</strong>. Untuk pemahaman yang lebih utuh,
          diskusikan dengan psikolog.
        </p>
      </section>
      {!outcome.crisis && <Insight outcome={outcome} answers={answers} />}
      <Recommendations items={outcome.recommendations} />
    </div>
  );
}
