'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { ApiError, homePathFor } from '@/lib/api';

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [role, setRole] = useState<'USER' | 'PSYCHOLOGIST'>('USER');
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSubmitting(true);
    setErrors([]);
    try {
      const user = await register({
        fullName: String(form.get('fullName')),
        email: String(form.get('email')),
        password: String(form.get('password')),
        role,
        acceptTerms: form.get('acceptTerms') === 'on',
      });
      router.push(homePathFor(user.role));
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.details?.length ? err.details.map((d) => d.message) : [err.message]);
      } else {
        setErrors(['Tidak dapat terhubung ke server']);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card mx-auto max-w-md">
      <h1 className="mb-6 text-xl font-semibold">Buat akun</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-2 text-sm">
          {(['USER', 'PSYCHOLOGIST'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`rounded-lg border px-3 py-2 ${
                role === r ? 'border-teal-700 bg-teal-50 text-teal-800' : 'border-slate-300'
              }`}
            >
              {r === 'USER' ? 'Saya mencari bantuan' : 'Saya psikolog'}
            </button>
          ))}
        </div>
        <label className="block text-sm">
          Nama lengkap
          <input name="fullName" required minLength={2} maxLength={100} autoComplete="name" className="input mt-1" />
        </label>
        <label className="block text-sm">
          Email
          <input name="email" type="email" required autoComplete="email" className="input mt-1" />
        </label>
        <label className="block text-sm">
          Password
          <input
            name="password"
            type="password"
            required
            minLength={10}
            autoComplete="new-password"
            className="input mt-1"
          />
          <span className="mt-1 block text-xs text-slate-500">Minimal 10 karakter, mengandung huruf dan angka.</span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input name="acceptTerms" type="checkbox" required className="mt-1" />
          <span>
            Saya menyetujui Syarat Layanan dan Kebijakan Privasi, termasuk pemrosesan data pribadi sesuai UU PDP.
          </span>
        </label>
        {role === 'PSYCHOLOGIST' && (
          <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
            Akun psikolog harus diverifikasi admin (STR/SIPP) sebelum tampil dan menerima booking.
          </p>
        )}
        {errors.length > 0 && (
          <ul className="list-inside list-disc text-sm text-red-600">
            {errors.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        )}
        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Memproses...' : 'Daftar'}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">
        Sudah punya akun?{' '}
        <Link href="/login" className="text-teal-700 hover:underline">
          Masuk
        </Link>
      </p>
    </div>
  );
}
