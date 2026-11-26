'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import type { Role } from '@/lib/api';

// UX guard only; the API enforces RBAC on every request.
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading || !user) return <p className="p-8 text-center text-sm text-slate-500">Memuat...</p>;
  if (!roles.includes(user.role)) {
    return <p className="p-8 text-center text-sm text-red-600">Anda tidak memiliki akses ke halaman ini.</p>;
  }
  return <>{children}</>;
}
