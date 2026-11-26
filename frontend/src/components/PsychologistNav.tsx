'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/psychologist/dashboard', label: 'Sesi' },
  { href: '/psychologist/schedule', label: 'Jadwal' },
  { href: '/psychologist/profile', label: 'Profil' },
  { href: '/psychologist/documents', label: 'Dokumen STR/SIPP' },
];

export function PsychologistNav() {
  const pathname = usePathname();
  return (
    <nav className="mb-6 flex gap-2 border-b border-slate-200 text-sm">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={`-mb-px border-b-2 px-3 py-2 ${
            pathname === l.href ? 'border-teal-700 text-teal-800' : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
