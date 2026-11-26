import Link from 'next/link';

export default function HomePage() {
  return (
    <section className="py-12 text-center">
      <h1 className="text-3xl font-bold text-slate-900">Konsultasi dengan psikolog terverifikasi</h1>
      <p className="mx-auto mt-4 max-w-xl text-slate-600">
        Ceritakan apa yang Anda rasakan kepada asisten AI pendamping, isi pra-asesmen singkat, lalu booking sesi dengan
        psikolog yang sesuai.
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <Link href="/register" className="btn-primary">
          Mulai sekarang
        </Link>
        <Link href="/login" className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-white">
          Saya sudah punya akun
        </Link>
      </div>
    </section>
  );
}
