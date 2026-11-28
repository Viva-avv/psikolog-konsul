import { effectiveAnswers, type SelfTestDefinition } from './types';

const ACE_SECTION = 'Bagian 1 · Sebelum usia 18 tahun, apakah hal berikut pernah kamu alami?';
const PTSD_SECTION = 'Bagian 2 · Dalam sebulan terakhir, apakah kamu...';

// ACE (Felitti dkk., 1998; CDC-Kaiser) adapted to Indonesian; PC-PTSD-5 (Prins dkk., 2016; US VA, public domain).
const ACE_ITEMS = [
  'Orang tua atau orang dewasa di rumah sering memaki, menghina, merendahkan, atau mempermalukanmu, atau bersikap sehingga kamu takut akan disakiti secara fisik.',
  'Orang tua atau orang dewasa di rumah sering mendorong, mencengkeram, menampar, melempar barang kepadamu, atau memukulmu hingga meninggalkan bekas atau luka.',
  'Orang dewasa atau seseorang yang jauh lebih tua darimu pernah menyentuh tubuhmu secara seksual, memintamu menyentuh tubuhnya secara seksual, atau mencoba maupun melakukan hubungan seksual denganmu.',
  'Kamu sering merasa tidak ada seorang pun di keluargamu yang menyayangimu atau menganggapmu penting, atau anggota keluargamu tidak saling peduli dan tidak dekat.',
  'Kamu sering tidak cukup makan, harus memakai pakaian kotor, tidak ada yang melindungimu, atau orang tuamu terlalu mabuk atau teler untuk merawatmu atau membawamu berobat saat dibutuhkan.',
  'Orang tua kandungmu pernah berpisah atau bercerai.',
  'Kamu pernah menyaksikan ibu atau pengasuhmu didorong, ditampar, ditendang, dipukul, dilempari barang, atau diancam dengan senjata di rumah.',
  'Kamu tinggal serumah dengan seseorang yang bermasalah dengan minuman keras atau menyalahgunakan narkoba.',
  'Ada anggota keluarga serumah yang mengalami depresi, gangguan jiwa, atau pernah mencoba bunuh diri.',
  'Ada anggota keluarga serumah yang pernah masuk penjara.',
];

const EXPOSURE_ITEM =
  'Pernahkah kamu mengalami kejadian yang sangat menakutkan, mengerikan, atau traumatis? Misalnya kecelakaan atau kebakaran serius, kekerasan fisik atau seksual, bencana alam, perang, melihat seseorang terluka parah atau meninggal, atau kehilangan orang tercinta karena pembunuhan atau bunuh diri.';

const PTSD_ITEMS = [
  'Mengalami mimpi buruk tentang kejadian itu, atau terus memikirkannya padahal tidak ingin?',
  'Berusaha keras untuk tidak memikirkannya, atau menghindari situasi yang mengingatkanmu pada kejadian itu?',
  'Terus-menerus waspada, berjaga-jaga, atau mudah terkejut?',
  'Merasa mati rasa atau terasing dari orang lain, aktivitas, atau lingkungan sekitarmu?',
  'Merasa bersalah atau tidak bisa berhenti menyalahkan diri sendiri atau orang lain atas kejadian itu atau masalah yang ditimbulkannya?',
];

const EXPOSURE_INDEX = ACE_ITEMS.length;
const PTSD_CUTOFF = 3;

const ITEMS = [
  ...ACE_ITEMS.map((text, i) => ({ text, ...(i === 0 && { section: ACE_SECTION }) })),
  { text: EXPOSURE_ITEM, section: 'Pengalaman yang sangat menakutkan' },
  ...PTSD_ITEMS.map((text, i) => ({
    text,
    showIf: { item: EXPOSURE_INDEX, value: 1 },
    ...(i === 0 && { section: PTSD_SECTION }),
  })),
];

function aceBand(score: number) {
  if (score === 0) {
    return {
      band: 'Tidak ada yang tercatat',
      description: 'Kamu tidak melaporkan pengalaman sulit dari daftar ini. Pengalaman sulit lain di luar daftar tetap valid jika kamu merasakannya.',
    };
  }
  if (score <= 3) {
    return {
      band: 'Beberapa pengalaman sulit',
      description:
        'Kamu pernah melewati beberapa pengalaman sulit di masa kecil. Skor ini menghitung jenis pengalaman, bukan seberapa besar dampaknya bagimu, dan banyak orang tumbuh tangguh setelahnya.',
    };
  }
  return {
    band: 'Banyak pengalaman sulit',
    description:
      'Kamu melewati banyak pengalaman sulit di masa kecil. Itu bukan salahmu. Penelitian menunjukkan pengalaman seperti ini bisa memengaruhi kesehatan fisik dan emosi di masa dewasa, dan dukungan yang tepat sangat membantu proses pemulihan.',
  };
}

export const trauma: SelfTestDefinition = {
  type: 'TRAUMA',
  slug: 'trauma',
  theme: 'trauma',
  title: 'Trauma Masa Lalu',
  tagline: 'Kenali pengalaman sulit masa kecil dan dampak trauma yang masih terasa.',
  description:
    'Bagian pertama mencatat pengalaman sulit sebelum usia 18 tahun. Bagian kedua melihat apakah suatu kejadian traumatis masih memengaruhimu sebulan terakhir. Hasilnya bukan diagnosis, melainkan bahan refleksi dan pertimbangan untuk mencari dukungan.',
  minutes: 4,
  source:
    'Adverse Childhood Experiences/ACE (Felitti dkk., 1998) dan Primary Care PTSD Screen for DSM-5/PC-PTSD-5 (Prins dkk., 2016, domain publik), diadaptasi ke Bahasa Indonesia.',
  warning:
    'Tes ini menanyakan pengalaman yang menyakitkan, termasuk kekerasan dan pelecehan. Kamu boleh berhenti kapan saja. Jika muncul rasa tidak nyaman yang berat, ambil jeda, hubungi orang yang kamu percaya, atau telepon 119 ext. 8.',
  prompt: 'Jawab sesuai pengalamanmu. Jawabanmu per pertanyaan tidak disimpan; hanya skor akhirnya.',
  options: [
    { value: 0, label: 'Tidak' },
    { value: 1, label: 'Ya' },
  ],
  items: ITEMS,
  evaluate(raw) {
    const answers = effectiveAnswers(ITEMS, raw);
    const aceScore = answers.slice(0, EXPOSURE_INDEX).reduce((a, b) => a + b, 0);
    const exposure = answers[EXPOSURE_INDEX] === 1;
    const ptsdScore = answers.slice(EXPOSURE_INDEX + 1).reduce((a, b) => a + b, 0);
    const positive = exposure && ptsdScore >= PTSD_CUTOFF;
    const ace = { score: aceScore, max: ACE_ITEMS.length, ...aceBand(aceScore) };
    const ptsd = {
      exposure,
      score: ptsdScore,
      max: PTSD_ITEMS.length,
      positive,
      description: !exposure
        ? 'Kamu tidak melaporkan kejadian yang sangat menakutkan atau traumatis.'
        : positive
          ? 'Kamu melaporkan beberapa tanda bahwa kejadian tersebut masih cukup memengaruhimu sebulan terakhir. Ini bukan diagnosis, tetapi tanda bahwa berbicara dengan psikolog yang memahami trauma bisa sangat membantu.'
          : 'Kejadian itu tampaknya tidak banyak memengaruhi keseharianmu sebulan terakhir. Tetap perhatikan dirimu; dampak trauma bisa muncul di waktu yang berbeda.',
    };
    const suggestSupport = positive || aceScore >= 4;
    return {
      headline: `Pengalaman sulit ${aceScore}/${ace.max}${exposure ? ` · Dampak trauma ${ptsdScore}/${ptsd.max}` : ''}`,
      result: { ace, ptsd, suggestSupport },
      facts: {
        tes: 'Trauma masa lalu',
        pengalamanSulitMasaKecil: `${aceScore} dari ${ace.max} jenis (${ace.band})`,
        pernahMengalamiKejadianTraumatis: exposure,
        ...(exposure && { tandaDampakTraumaSebulanTerakhir: `${ptsdScore} dari ${ptsd.max}` }),
        disarankanBicaraDenganPsikolog: suggestSupport,
      },
      slugs: ['trauma'],
      safety: 0,
    };
  },
};
