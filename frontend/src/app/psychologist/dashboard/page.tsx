'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RequireRole } from '@/components/RequireRole';
import { PsychologistNav } from '@/components/PsychologistNav';
import { StatusBadge } from '@/components/StatusBadge';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import type { Booking, OwnProfile, Paginated, VerificationStatus } from '@/lib/types';

const VERIFICATION: Record<VerificationStatus, { label: string; className: string }> = {
  PENDING: { label: 'Menunggu verifikasi admin', className: 'bg-amber-50 text-amber-800' },
  VERIFIED: { label: 'Terverifikasi', className: 'bg-teal-50 text-teal-800' },
  REJECTED: { label: 'Ditolak — periksa catatan di halaman Dokumen', className: 'bg-red-50 text-red-700' },
};

function Dashboard() {
  const [profile, setProfile] = useState<OwnProfile | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);

  useEffect(() => {
    api<{ profile: OwnProfile }>('/psychologists/me/profile').then((r) => setProfile(r.profile));
    api<Paginated<Booking>>('/psychologists/me/bookings?status=CONFIRMED').then((r) => setBookings(r.items));
  }, []);

  const status = profile ? VERIFICATION[profile.verificationStatus] : null;

  return (
    <>
      {status && <p className={`mb-6 rounded-lg p-3 text-sm ${status.className}`}>Status akun: {status.label}</p>}
      <div className="card">
        <h1 className="mb-4 text-xl font-semibold">Sesi mendatang</h1>
        {bookings.length === 0 ? (
          <p className="text-sm text-slate-500">Belum ada sesi terkonfirmasi.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {bookings.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/psychologist/clients/${b.id}`}
                  className="flex items-center justify-between py-3 hover:bg-slate-50"
                >
                  <div>
                    <p className="font-medium">{b.client?.fullName}</p>
                    <p className="text-sm text-slate-500">
                      {formatDateTime(b.startAt)} · {b.mode === 'VIDEO' ? 'Video' : 'Chat'}
                    </p>
                  </div>
                  <StatusBadge status={b.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

export default function PsychologistDashboardPage() {
  return (
    <RequireRole roles={['PSYCHOLOGIST']}>
      <PsychologistNav />
      <Dashboard />
    </RequireRole>
  );
}
