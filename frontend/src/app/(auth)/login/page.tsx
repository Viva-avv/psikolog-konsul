'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { ApiError, homePathFor } from '@/lib/api';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSubmitting(true);
    setError(null);
    try {
      const user = await login(String(form.get('email')), String(form.get('password')));
      router.push(homePathFor(user.role));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Tidak dapat terhubung ke server');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card mx-auto max-w-md">
      <h1 className="mb-6 text-xl font-semibold">Masuk</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block text-sm">
          Email
          <input name="email" type="email" required autoComplete="email" className="input mt-1" />
        </label>
        <label className="block text-sm">
          Password
          <input name="password" type="password" required autoComplete="current-password" className="input mt-1" />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Memproses...' : 'Masuk'}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">
        Belum punya akun?{' '}
        <Link href="/register" className="text-teal-700 hover:underline">
          Daftar
        </Link>
      </p>
    </div>
  );
}
