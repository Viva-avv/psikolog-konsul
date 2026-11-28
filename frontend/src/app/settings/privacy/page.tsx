'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { RequireRole } from '@/components/RequireRole';
import { api, apiBlob, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useConsents } from '@/lib/use-consents';
import type { ConsentType } from '@/lib/types';

const ITEMS: Array<{ type: ConsentType; title: string; desc: string; revokeWarning?: string }> = [
  {
    type: 'AI_PROCESSING',
    title: 'Pemrosesan oleh AI',
    desc: 'Pesan chat, keluhan pra-asesmen, dan skor tes Temukan Dirimu (saat meminta penjelasan AI) diproses oleh model AI (Ollama) yang berjalan di server platform.',
  },
  {
    type: 'STORE_AI_CHAT',
    title: 'Simpan riwayat chat AI',
    desc: 'Riwayat percakapan dengan AI disimpan terenkripsi agar bisa dilanjutkan.',
    revokeWarning: 'Semua riwayat chat AI akan dihapus permanen.',
  },
  {
    type: 'STORE_ASSESSMENT',
    title: 'Simpan hasil asesmen',
    desc: 'Hasil PHQ-9/GAD-7, tes Temukan Dirimu, dan ringkasan keluhan disimpan terenkripsi.',
    revokeWarning: 'Semua hasil asesmen, hasil tes Temukan Dirimu, dan ringkasan akan dihapus, dan berbagi ke psikolog dicabut.',
  },
];

function Privacy() {
  const { has, loading, grant, revoke } = useConsents();
  const [busy, setBusy] = useState<ConsentType | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(item: (typeof ITEMS)[number]) {
    const active = has(item.type);
    if (active && item.revokeWarning && !confirm(`${item.revokeWarning} Lanjutkan?`)) return;
    setBusy(item.type);
    setError(null);
    try {
      await (active ? revoke(item.type) : grant(item.type));
    } catch {
      setError('Gagal memperbarui persetujuan');
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <p className="text-sm text-slate-500">Memuat...</p>;

  return (
    <div className="card max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold">Privasi & persetujuan</h1>
      <p className="text-sm text-slate-600">
        Sesuai UU Pelindungan Data Pribadi, Anda dapat memberi atau mencabut persetujuan kapan saja.
      </p>
      <ul className="divide-y divide-slate-100">
        {ITEMS.map((item) => {
          const active = has(item.type);
          return (
            <li key={item.type} className="flex items-start justify-between gap-4 py-4">
              <div>
                <p className="font-medium">{item.title}</p>
                <p className="text-sm text-slate-600">{item.desc}</p>
              </div>
              <button
                onClick={() => toggle(item)}
                disabled={busy === item.type}
                role="switch"
                aria-checked={active}
                aria-label={item.title}
                className={`relative h-6 w-11 shrink-0 rounded-full transition ${active ? 'bg-teal-700' : 'bg-slate-300'}`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${active ? 'left-5' : 'left-0.5'}`}
                />
              </button>
            </li>
          );
        })}
      </ul>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

function DataRights() {
  const { logout } = useAuth();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function exportData() {
    setError(null);
    try {
      const blob = await apiBlob('/users/me/export');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'data-saya.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Gagal mengunduh data');
    }
  }

  async function deleteAccount(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/users/me', { method: 'DELETE', body: { password } });
      await logout();
      router.replace('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menghapus akun');
      setBusy(false);
    }
  }

  return (
    <div className="card max-w-2xl space-y-6">
      <div>
        <h2 className="font-semibold">Unduh data saya</h2>
        <p className="mb-2 text-sm text-slate-600">Salinan semua data pribadi Anda dalam format JSON.</p>
        <button onClick={exportData} className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">
          Unduh JSON
        </button>
      </div>

      <form onSubmit={deleteAccount} className="space-y-2 border-t border-slate-200 pt-6">
        <h2 className="font-semibold text-red-700">Hapus akun</h2>
        <p className="text-sm text-slate-600">
          Chat AI, hasil asesmen, hasil tes Temukan Dirimu, ringkasan, dan pesan sesi Anda dihapus permanen; booking
          mendatang dibatalkan. Catatan
          transaksi disimpan tanpa identitas untuk kewajiban pembukuan, dan catatan klinis psikolog disimpan sesuai
          kewajiban rekam layanan.
        </p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoComplete="current-password"
          required
          className="input max-w-sm"
        />
        <input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder='Ketik "HAPUS" untuk konfirmasi'
          className="input max-w-sm"
        />
        <button
          type="submit"
          disabled={busy || confirmText !== 'HAPUS' || !password}
          className="block rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
        >
          {busy ? 'Menghapus...' : 'Hapus akun permanen'}
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

export default function PrivacyPage() {
  return (
    <RequireRole roles={['USER']}>
      <div className="space-y-6">
        <Privacy />
        <DataRights />
      </div>
    </RequireRole>
  );
}
