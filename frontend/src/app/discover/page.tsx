'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDateTime } from '@/lib/format';
import type { SelfTestHistoryItem, SelfTestSummary, SelfTestTheme } from '@/lib/types';

const THEMES: Array<{ key: SelfTestTheme; title: string; desc: string; accent: string }> = [
  {
    key: 'kepribadian',
    title: 'Tipe Kepribadian',
    desc: 'Kenali cara kamu berpikir, merasa, dan berinteraksi dengan dunia.',
    accent: 'border-l-teal-600',
  },
  {
    key: 'trauma',
    title: 'Trauma Masa Lalu',
    desc: 'Lihat pengalaman sulit yang mungkin masih memengaruhimu hari ini.',
    accent: 'border-l-indigo-500',
  },
  {
    key: 'patah-hati',
    title: 'Gangguan Hati',
    desc: 'Ukur seberapa dalam luka hati setelah putus cinta, ditolak, atau dikhianati.',
    accent: 'border-l-rose-500',
  },
  {
    key: 'bahasa-cinta',
    title: 'Bahasa Cinta',
    desc: 'Temukan cara yang paling membuatmu merasa disayangi.',
    accent: 'border-l-amber-500',
  },
];

function History() {
  const [items, setItems] = useState<SelfTestHistoryItem[] | null>(null);

  useEffect(() => {
    api<{ items: SelfTestHistoryItem[] }>('/discover/results')
      .then((r) => setItems(r.items))
      .catch(() => setItems([]));
  }, []);

  if (!items) return <p className="text-sm text-slate-500">Memuat riwayat...</p>;
  if (!items.length) {
    return (
      <p className="text-sm text-slate-600">
        Belum ada hasil tersimpan. Hasil tes disimpan bila kamu mengaktifkan &quot;Simpan hasil asesmen&quot; sebelum
        memulai tes.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((r) => (
        <li key={r.id}>
          <Link href={`/discover/hasil/${r.id}`} className="flex flex-wrap justify-between gap-2 py-3 text-sm hover:text-teal-700">
            <span>
              <strong>{r.title}</strong> · {r.headline}
            </span>
            <span className="text-slate-500">{formatDateTime(r.createdAt)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function DiscoverPage() {
  const { user, loading } = useAuth();
  const [tests, setTests] = useState<SelfTestSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ items: SelfTestSummary[] }>('/discover/tests')
      .then((r) => setTests(r.items))
      .catch(() => setError('Gagal memuat daftar tes'));
  }, []);

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-slate-900">Temukan Dirimu</h1>
        <p className="mx-auto mt-3 max-w-2xl text-slate-600">
          Tes mandiri singkat untuk mengenal kepribadian, luka masa lalu, kondisi hati, dan cara kamu mencintai serta
          ingin dicintai. Hasilnya adalah bahan refleksi, <strong>bukan diagnosis</strong>.
        </p>
      </div>

      {!loading && !user && (
        <p className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">
          Kamu bisa langsung mencoba tanpa akun.{' '}
          <Link href="/login" className="font-medium underline">
            Masuk
          </Link>{' '}
          atau{' '}
          <Link href="/register" className="font-medium underline">
            daftar
          </Link>{' '}
          agar hasilmu bisa disimpan dan dijelaskan oleh AI pendamping.
        </p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {THEMES.map((theme) => {
        const themed = tests.filter((t) => t.theme === theme.key);
        if (!themed.length) return null;
        return (
          <section key={theme.key} className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold">{theme.title}</h2>
              <p className="text-sm text-slate-600">{theme.desc}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {themed.map((t) => (
                <Link
                  key={t.slug}
                  href={`/discover/${t.slug}`}
                  className={`card border-l-4 ${theme.accent} transition hover:shadow-md`}
                >
                  <strong>{t.title}</strong>
                  <p className="mt-1 text-sm text-slate-600">{t.tagline}</p>
                  <p className="mt-3 text-xs text-slate-500">
                    {t.itemCount} pertanyaan · ±{t.minutes} menit
                  </p>
                </Link>
              ))}
            </div>
          </section>
        );
      })}

      {user?.role === 'USER' && (
        <section className="card space-y-2">
          <h2 className="font-semibold">Riwayat hasilmu</h2>
          <History />
        </section>
      )}
    </div>
  );
}
