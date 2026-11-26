'use client';

import Link from 'next/link';
import { RequireRole } from '@/components/RequireRole';
import { useAuth } from '@/lib/auth-context';

export default function UserDashboardPage() {
  const { user } = useAuth();
  return (
    <RequireRole roles={['USER']}>
      <div className="card">
        <h1 className="text-xl font-semibold">Halo, {user?.fullName}</h1>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/ai-chat" className="btn-primary">
            Cerita dengan AI pendamping
          </Link>
          <Link href="/assessment" className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">
            Pra-asesmen
          </Link>
          <Link href="/psychologists" className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">
            Cari psikolog
          </Link>
          <Link href="/bookings" className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">
            Riwayat sesi
          </Link>
          <Link href="/settings/privacy" className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">
            Privasi
          </Link>
        </div>
      </div>
    </RequireRole>
  );
}
