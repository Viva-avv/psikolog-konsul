import type { Level, SelfTestDefinition } from './types';

type Trait = 'O' | 'C' | 'E' | 'A' | 'N';

// Mini-IPIP (Donnellan et al., 2006), 20 public-domain IPIP items; Indonesian wording adapted for this app.
const ITEMS: Array<{ trait: Trait; reverse: boolean; text: string }> = [
  { trait: 'E', reverse: false, text: 'Aku menjadi pusat keramaian di acara kumpul-kumpul.' },
  { trait: 'A', reverse: false, text: 'Aku ikut merasakan apa yang dirasakan orang lain.' },
  { trait: 'C', reverse: false, text: 'Aku langsung mengerjakan tugas atau pekerjaan rumah tanpa menunda.' },
  { trait: 'N', reverse: false, text: 'Suasana hatiku sering naik-turun.' },
  { trait: 'O', reverse: false, text: 'Imajinasiku sangat hidup.' },
  { trait: 'E', reverse: true, text: 'Aku tidak banyak bicara.' },
  { trait: 'A', reverse: true, text: 'Aku tidak tertarik dengan masalah orang lain.' },
  { trait: 'C', reverse: true, text: 'Aku sering lupa mengembalikan barang ke tempatnya.' },
  { trait: 'N', reverse: true, text: 'Hampir sepanjang waktu aku merasa santai.' },
  { trait: 'O', reverse: true, text: 'Aku tidak tertarik pada ide-ide abstrak.' },
  { trait: 'E', reverse: false, text: 'Di sebuah acara, aku mengobrol dengan banyak orang yang berbeda.' },
  { trait: 'A', reverse: false, text: 'Aku bisa merasakan emosi orang lain.' },
  { trait: 'C', reverse: false, text: 'Aku suka keteraturan.' },
  { trait: 'N', reverse: false, text: 'Aku mudah merasa kesal.' },
  { trait: 'O', reverse: true, text: 'Aku kesulitan memahami ide-ide abstrak.' },
  { trait: 'E', reverse: true, text: 'Aku lebih suka berada di belakang layar.' },
  { trait: 'A', reverse: true, text: 'Aku tidak terlalu tertarik pada orang lain.' },
  { trait: 'C', reverse: true, text: 'Aku sering membuat segala sesuatu jadi berantakan.' },
  { trait: 'N', reverse: true, text: 'Aku jarang merasa sedih atau murung.' },
  { trait: 'O', reverse: true, text: 'Imajinasiku tidak terlalu bagus.' },
];

const TRAITS: Record<Trait, { name: string; text: Record<Level, string> }> = {
  O: {
    name: 'Keterbukaan',
    text: {
      Tinggi: 'Kamu penasaran, imajinatif, dan senang menjelajahi ide, seni, atau pengalaman baru.',
      Sedang: 'Kamu terbuka pada hal baru, tetapi juga menghargai cara-cara yang sudah terbukti.',
      Rendah: 'Kamu lebih nyaman dengan hal yang praktis, konkret, dan sudah dikenal.',
    },
  },
  C: {
    name: 'Ketelitian',
    text: {
      Tinggi: 'Kamu teratur, bisa diandalkan, dan cenderung menyelesaikan tugas sesuai rencana.',
      Sedang: 'Kamu cukup terorganisasi, tapi masih memberi ruang untuk fleksibilitas.',
      Rendah: 'Kamu spontan dan santai soal aturan; struktur sederhana bisa membantu saat tugas menumpuk.',
    },
  },
  E: {
    name: 'Ekstraversi',
    text: {
      Tinggi: 'Kamu mendapat energi dari interaksi sosial dan nyaman menjadi pusat perhatian.',
      Sedang: 'Kamu menikmati keramaian sesekali, tapi juga butuh waktu tenang untuk diri sendiri.',
      Rendah: 'Kamu cenderung pendiam dan mengisi ulang energi lewat waktu sendiri atau bersama sedikit orang.',
    },
  },
  A: {
    name: 'Keramahan',
    text: {
      Tinggi: 'Kamu peduli, hangat, dan mudah berempati pada orang lain.',
      Sedang: 'Kamu bisa bersikap hangat sekaligus tegas saat dibutuhkan.',
      Rendah: 'Kamu lugas dan kritis; ingat bahwa sedikit kehangatan bisa membuat pesanmu lebih mudah diterima.',
    },
  },
  N: {
    name: 'Kepekaan Emosi',
    text: {
      Tinggi: 'Kamu merasakan emosi dengan kuat dan mudah terpengaruh stres; teknik menenangkan diri bisa sangat membantu.',
      Sedang: 'Kamu kadang terbawa perasaan, tetapi umumnya bisa kembali tenang.',
      Rendah: 'Kamu cenderung tenang dan stabil, bahkan saat menghadapi tekanan.',
    },
  },
};

const level = (sum: number): Level => (sum >= 15 ? 'Tinggi' : sum >= 10 ? 'Sedang' : 'Rendah');

export const bigFive: SelfTestDefinition = {
  type: 'BIG_FIVE',
  slug: 'big-five',
  theme: 'kepribadian',
  title: 'Kepribadian Big Five',
  tagline: 'Lima dimensi kepribadian yang paling banyak diteliti secara ilmiah.',
  description:
    'Mengukur keterbukaan, ketelitian, ekstraversi, keramahan, dan kepekaan emosi. Tidak ada jawaban benar atau salah; setiap profil punya kekuatannya sendiri.',
  minutes: 4,
  source: 'Mini-IPIP (Donnellan dkk., 2006) dari International Personality Item Pool (domain publik), diadaptasi ke Bahasa Indonesia.',
  prompt: 'Seberapa tepat pernyataan berikut menggambarkan dirimu secara umum, bukan seperti yang kamu inginkan?',
  options: [
    { value: 1, label: 'Sangat tidak sesuai' },
    { value: 2, label: 'Tidak sesuai' },
    { value: 3, label: 'Netral' },
    { value: 4, label: 'Sesuai' },
    { value: 5, label: 'Sangat sesuai' },
  ],
  items: ITEMS.map(({ text }) => ({ text })),
  evaluate(answers) {
    const sums: Record<Trait, number> = { O: 0, C: 0, E: 0, A: 0, N: 0 };
    ITEMS.forEach((item, i) => {
      sums[item.trait] += item.reverse ? 6 - answers[i] : answers[i];
    });
    const traits = (Object.keys(TRAITS) as Trait[]).map((key) => {
      const lvl = level(sums[key]);
      return {
        key,
        name: TRAITS[key].name,
        score: sums[key],
        max: 20,
        percent: Math.round(((sums[key] - 4) / 16) * 100),
        level: lvl,
        description: TRAITS[key].text[lvl],
      };
    });
    return {
      headline: traits.map((t) => `${t.name} ${t.level.toLowerCase()}`).join(', '),
      result: { traits },
      facts: {
        tes: 'Kepribadian Big Five',
        dimensi: traits.map((t) => ({ nama: t.name, tingkat: t.level, persen: t.percent, arti: t.description })),
      },
      slugs: sums.N >= 15 ? ['pengembangan-diri', 'stres-burnout'] : ['pengembangan-diri'],
      safety: 0,
    };
  },
};
