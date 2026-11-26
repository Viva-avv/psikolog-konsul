import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/lib/auth-context';
import { Navbar } from '@/components/Navbar';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ruang Pulih — Konsultasi Psikolog Online',
  description: 'Konsultasi dengan psikolog terverifikasi, didampingi asisten AI.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body className="flex min-h-screen flex-col bg-slate-50 text-slate-900 antialiased">
        <AuthProvider>
          <Navbar />
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
          <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
            Layanan ini bukan layanan darurat. Jika Anda dalam bahaya, hubungi <strong>119 ext. 8</strong> (Hotline
            Kesehatan Jiwa Kemenkes) atau <strong>112</strong>.
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
