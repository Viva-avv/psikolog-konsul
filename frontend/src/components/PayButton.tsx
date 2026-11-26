'use client';

import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import type { Booking } from '@/lib/types';

interface SnapCallbacks {
  onSuccess?: () => void;
  onPending?: () => void;
  onError?: () => void;
  onClose?: () => void;
}

declare global {
  interface Window {
    snap?: { pay: (token: string, callbacks: SnapCallbacks) => void };
  }
}

const SNAP_URL = process.env.NEXT_PUBLIC_MIDTRANS_SNAP_URL ?? 'https://app.sandbox.midtrans.com/snap/snap.js';
const CLIENT_KEY = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY ?? '';

let snapLoading: Promise<void> | null = null;

function loadSnap() {
  if (window.snap) return Promise.resolve();
  snapLoading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SNAP_URL;
    script.dataset.clientKey = CLIENT_KEY;
    script.onload = () => resolve();
    script.onerror = () => {
      snapLoading = null;
      reject(new Error('Gagal memuat Midtrans'));
    };
    document.body.appendChild(script);
  });
  return snapLoading;
}

export function PayButton({ bookingId, onUpdate }: { bookingId: string; onUpdate: (b: Booking) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sync() {
    try {
      const r = await api<{ booking: Booking }>(`/payments/bookings/${bookingId}/sync`, { method: 'POST' });
      onUpdate(r.booking);
    } catch {
      // Webhook will still update the booking; ignore sync errors here.
    } finally {
      setBusy(false);
    }
  }

  async function pay() {
    if (!CLIENT_KEY) return setError('Pembayaran belum dikonfigurasi (NEXT_PUBLIC_MIDTRANS_CLIENT_KEY).');
    setBusy(true);
    setError(null);
    try {
      const { token } = await api<{ token: string }>(`/payments/bookings/${bookingId}/snap`, { method: 'POST' });
      await loadSnap();
      window.snap!.pay(token, {
        onSuccess: sync,
        onPending: sync,
        onClose: sync,
        onError: () => {
          setError('Pembayaran gagal, silakan coba metode lain.');
          setBusy(false);
        },
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Gagal memulai pembayaran');
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 space-y-2">
      <button onClick={pay} disabled={busy} className="btn-primary w-full">
        {busy ? 'Memproses...' : 'Bayar sekarang'}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-xs text-slate-500">Pembayaran diproses oleh Midtrans (mode sandbox).</p>
    </div>
  );
}
