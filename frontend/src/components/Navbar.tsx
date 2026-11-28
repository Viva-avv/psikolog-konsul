'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { homePathFor } from '@/lib/api';

export function Navbar() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  return (
    <header className="border-b border-slate-200 bg-white">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="font-semibold text-teal-800">
          Ruang Pulih
        </Link>
        {!loading && (
          <div className="flex items-center gap-4 text-sm">
            <Link href="/discover" className="text-slate-700 hover:text-teal-700">
              Temukan Dirimu
            </Link>
            <Link href="/psychologists" className="text-slate-700 hover:text-teal-700">
              Psikolog
            </Link>
            {user ? (
              <>
                <Link href={homePathFor(user.role)} className="text-slate-700 hover:text-teal-700">
                  Dashboard
                </Link>
                <span className="text-slate-500">{user.fullName}</span>
                <button
                  onClick={async () => {
                    await logout();
                    router.push('/login');
                  }}
                  className="text-slate-700 hover:text-red-600"
                >
                  Keluar
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="text-slate-700 hover:text-teal-700">
                  Masuk
                </Link>
                <Link href="/register" className="btn-primary">
                  Daftar
                </Link>
              </>
            )}
          </div>
        )}
      </nav>
    </header>
  );
}
