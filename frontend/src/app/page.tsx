import Link from 'next/link';

export default function HomePage() {
  return (
    <section className="py-12 text-center">
      <h1 className="text-3xl font-bold text-slate-900">Konsultasi dengan psikolog terverifikasi</h1>
      <p className="mx-auto mt-4 max-w-xl text-slate-600">
        Ceritakan apa yang Anda rasakan kepada asisten AI pendamping, isi pra-asesmen singkat, lalu booking sesi dengan
        psikolog yang sesuai.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/register" className="btn-primary">
          Mulai sekarang
        </Link>
        <Link href="/login" className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-white">
          Saya sudah punya akun
        </Link>
      </div>
      <Link
        href="/discover"
        className="mx-auto mt-10 block max-w-xl rounded-xl border border-teal-200 bg-white p-5 text-left shadow-sm hover:border-teal-500"
      >
        <strong className="text-teal-800">Temukan Dirimu →</strong>
        <p className="mt-1 text-sm text-slate-600">
          Tes mandiri gratis tanpa perlu daftar: tipe kepribadian, trauma masa lalu, patah hati, dan bahasa cinta.
        </p>
      </Link>
    </section>
  );
}
