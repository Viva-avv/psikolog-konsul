'use client';

import { useState } from 'react';
import { api, ApiError } from '@/lib/api';

export function VideoPanel({ bookingId, canJoin }: { bookingId: string; canJoin: boolean }) {
  const [src, setSrc] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join() {
    setBusy(true);
    setError(null);
    try {
      const { url, token } = await api<{ url: string; token: string }>(`/bookings/${bookingId}/video`);
      setSrc(`${url}?t=${encodeURIComponent(token)}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Gagal membuka video');
    } finally {
      setBusy(false);
    }
  }

  if (src) {
    return (
      <div className="space-y-2">
        <iframe
          src={src}
          title="Video call sesi"
          allow="camera; microphone; fullscreen; display-capture; autoplay"
          className="h-[60vh] w-full rounded-xl border border-slate-200 bg-black"
        />
        <button onClick={() => setSrc(null)} className="text-sm text-red-600 hover:underline">
          Tinggalkan video
        </button>
      </div>
    );
  }

  return (
    <div className="card flex h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <p className="text-sm text-slate-600">
        {canJoin ? 'Ruang video siap. Pastikan kamera dan mikrofon diizinkan.' : 'Ruang video dibuka 10 menit sebelum sesi.'}
      </p>
      <button onClick={join} disabled={!canJoin || busy} className="btn-primary">
        {busy ? 'Menyiapkan...' : 'Masuk video call'}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
