'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/admin', label: 'Ringkasan' },
  { href: '/admin/users', label: 'Pengguna' },
  { href: '/admin/verification', label: 'Verifikasi' },
  { href: '/admin/crisis', label: 'Insiden krisis' },
  { href: '/admin/refunds', label: 'Refund' },
  { href: '/admin/audit', label: 'Audit log' },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 text-sm">
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

export function Pager({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
      <span>
        {total} data · halaman {page}/{pages}
      </span>
      <div className="flex gap-2">
        <button disabled={page <= 1} onClick={() => onChange(page - 1)} className="rounded border px-3 py-1 disabled:opacity-40">
          ←
        </button>
        <button
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
          className="rounded border px-3 py-1 disabled:opacity-40"
        >
          →
        </button>
      </div>
    </div>
  );
}
