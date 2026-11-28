import type { SelfTestDefinition } from './types';

// Original reflection scale written for this app (not a validated clinical instrument). Last item is a safety check.
const ITEMS: Array<{ text: string; area?: { name: string; tip: string } }> = [
  {
    text: 'Pikiran tentang dia atau kejadian itu terus muncul, bahkan saat aku tidak ingin memikirkannya.',
    area: { name: 'Pikiran yang terus berulang', tip: 'Sediakan "waktu khawatir" 15 menit sehari untuk menuliskan pikiranmu, lalu alihkan perhatian ke aktivitas lain di luar waktu itu.' },
  },
  {
    text: 'Aku sangat merindukannya dan merasa ada bagian diriku yang hilang.',
    area: { name: 'Kerinduan mendalam', tip: 'Rindu adalah bagian wajar dari kehilangan. Tulis surat yang tidak perlu dikirim untuk menyalurkan perasaanmu.' },
  },
  {
    text: 'Aku sulit menerima bahwa hubungan itu benar-benar sudah berakhir atau bahwa hal itu terjadi.',
    area: { name: 'Sulit menerima kenyataan', tip: 'Penerimaan butuh waktu. Coba ucapkan pada dirimu sendiri apa yang terjadi dengan kalimat sederhana dan apa adanya.' },
  },
  {
    text: 'Aku merasa marah, kecewa, atau sakit hati setiap kali teringat.',
    area: { name: 'Marah dan kecewa', tip: 'Salurkan amarah lewat gerak fisik, seperti jalan cepat atau olahraga, atau tuliskan semuanya tanpa disensor lalu robek kertasnya.' },
  },
  {
    text: 'Aku menyalahkan diri sendiri atau merasa tidak cukup berharga.',
    area: { name: 'Harga diri terluka', tip: 'Tulis tiga hal yang kamu hargai dari dirimu setiap malam. Berakhirnya hubungan tidak menentukan nilai dirimu.' },
  },
  {
    text: 'Aku mengecek media sosialnya atau mencari kabar tentangnya.',
    area: { name: 'Sering mencari kabar', tip: 'Coba bisukan atau arsipkan akunnya untuk sementara. Itu bukan tanda lemah, melainkan cara memberi ruang bagi hatimu untuk pulih.' },
  },
  {
    text: 'Tidur, nafsu makan, atau konsentrasiku terganggu karena kejadian ini.',
    area: { name: 'Tidur dan konsentrasi terganggu', tip: 'Jaga rutinitas dasar: jam tidur yang teratur, makan walau sedikit, dan kurangi layar sebelum tidur.' },
  },
  {
    text: 'Aku menarik diri dari teman, keluarga, atau kegiatan yang biasanya kusukai.',
    area: { name: 'Menarik diri', tip: 'Hubungi satu orang yang kamu percaya minggu ini, meski hanya untuk mengobrol ringan.' },
  },
  {
    text: 'Aku sulit membayangkan bisa percaya atau dekat lagi dengan orang lain.',
    area: { name: 'Sulit percaya lagi', tip: 'Kepercayaan bisa dibangun kembali perlahan. Mulailah dari hubungan yang sudah terasa aman, seperti sahabat atau keluarga.' },
  },
  { text: 'Aku merasa hidup tidak ada artinya, berpikir lebih baik mati, atau ingin menyakiti diri sendiri.' },
];

const SAFETY_INDEX = ITEMS.length - 1;
const MAX = ITEMS.length * 3;

const BANDS: Array<[max: number, band: string, description: string]> = [
  [7, 'Ringan', 'Luka hatimu tampaknya mulai pulih. Tetap beri dirimu waktu dan perlakukan dirimu dengan lembut.'],
  [15, 'Sedang', 'Kejadian ini masih cukup terasa dan memengaruhi keseharianmu. Itu wajar; dukungan dari orang terdekat atau psikolog bisa membantu mempercepat pemulihan.'],
  [23, 'Berat', 'Luka hati ini sangat membebanimu saat ini. Kamu tidak harus melewatinya sendirian; berbicara dengan psikolog bisa membantumu memproses perasaan ini.'],
  [MAX, 'Sangat berat', 'Kamu sedang berada di masa yang sangat sulit. Kami sangat menyarankanmu berbicara dengan psikolog dan memberi tahu orang yang kamu percaya tentang kondisimu.'],
];

export const heartbreak: SelfTestDefinition = {
  type: 'HEARTBREAK',
  slug: 'patah-hati',
  theme: 'patah-hati',
  title: 'Patah Hati',
  tagline: 'Seberapa dalam luka hati setelah putus, ditolak, atau dikhianati?',
  description:
    'Untuk kamu yang sedang melewati putus cinta, perceraian, penolakan, atau pengkhianatan dari orang yang dekat. Tes ini membantumu melihat area mana yang paling terdampak dan langkah kecil untuk mulai pulih.',
  minutes: 3,
  source: 'Skala refleksi yang disusun untuk Ruang Pulih, bukan instrumen klinis yang tervalidasi.',
  prompt: 'Pikirkan kejadian paling menyakitkan yang kamu alami baru-baru ini. Dalam 2 minggu terakhir, seberapa sering kamu mengalami hal berikut?',
  options: [
    { value: 0, label: 'Tidak pernah' },
    { value: 1, label: 'Kadang-kadang' },
    { value: 2, label: 'Sering' },
    { value: 3, label: 'Hampir setiap saat' },
  ],
  items: ITEMS.map(({ text }) => ({ text })),
  evaluate(answers) {
    const score = answers.reduce((a, b) => a + b, 0);
    const [, band, description] = BANDS.find(([max]) => score <= max)!;
    const areas = ITEMS.flatMap((item, i) => (item.area && answers[i] >= 2 ? [{ ...item.area, level: answers[i] }] : []))
      .sort((a, b) => b.level - a.level)
      .map(({ name, tip }) => ({ name, tip }));
    const safety = answers[SAFETY_INDEX];
    return {
      headline: `Patah hati: ${band} (${score}/${MAX})`,
      result: { score, max: MAX, band, description, areas, safetyConcern: safety > 0 },
      facts: {
        tes: 'Patah hati',
        tingkat: band,
        arti: description,
        skor: `${score} dari ${MAX}`,
        areaPalingTerdampak: areas.map((a) => a.name),
      },
      slugs: ['hubungan-keluarga', 'pernikahan', 'duka'],
      safety,
    };
  },
};
