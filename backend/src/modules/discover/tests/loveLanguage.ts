import type { SelfTestDefinition } from './types';

type Lang = 'WORDS' | 'TIME' | 'GIFTS' | 'SERVICE' | 'TOUCH';

const LANGS: Record<Lang, { name: string; description: string; tip: string }> = {
  WORDS: {
    name: 'Kata-kata Penegasan',
    description: 'Kamu merasa paling disayangi lewat ucapan tulus: pujian, terima kasih, kata penyemangat, atau ungkapan sayang.',
    tip: 'Beri tahu orang terdekat bahwa pesan singkat seperti "aku bangga sama kamu" sangat berarti bagimu.',
  },
  TIME: {
    name: 'Waktu Berkualitas',
    description: 'Kamu merasa paling disayangi saat seseorang hadir sepenuhnya untukmu: mendengarkan, mengobrol, dan berkegiatan bersama tanpa gangguan.',
    tip: 'Usulkan waktu rutin berdua tanpa ponsel, misalnya jalan sore atau makan malam bersama setiap minggu.',
  },
  GIFTS: {
    name: 'Pemberian Hadiah',
    description: 'Kamu merasa paling disayangi lewat tanda perhatian yang bisa digenggam; bukan soal harganya, tetapi bukti bahwa kamu diingat.',
    tip: 'Ceritakan bahwa hal kecil seperti camilan favorit atau oleh-oleh sederhana membuatmu merasa diperhatikan.',
  },
  SERVICE: {
    name: 'Tindakan Melayani',
    description: 'Kamu merasa paling disayangi saat seseorang meringankan bebanmu lewat bantuan nyata, karena tindakan berbicara lebih keras daripada kata-kata.',
    tip: 'Sampaikan dengan jelas bantuan apa yang paling kamu hargai, karena orang lain sering tidak bisa menebaknya.',
  },
  TOUCH: {
    name: 'Sentuhan Fisik',
    description: 'Kamu merasa paling disayangi lewat kedekatan fisik yang hangat dan aman: pelukan, genggaman tangan, atau rangkulan.',
    tip: 'Komunikasikan bentuk sentuhan yang membuatmu nyaman, dan hormati juga batasan orang lain.',
  },
};

type Choice = [Lang, string];

// Original forced-choice items inspired by Gary Chapman's five love languages concept (not the official quiz).
// Every pair of languages appears twice, so each language can score at most 8.
const PAIRS: Array<[Choice, Choice]> = [
  [['WORDS', 'Dia memujiku dengan tulus saat aku berhasil melakukan sesuatu.'], ['TIME', 'Dia meluangkan waktu untuk mengobrol berdua tanpa sibuk dengan ponselnya.']],
  [['GIFTS', 'Dia membawakan oleh-oleh kecil yang mengingatkannya padaku.'], ['SERVICE', 'Dia membantu menyelesaikan pekerjaan yang sedang kukerjakan.']],
  [['TOUCH', 'Dia memelukku saat kami bertemu atau berpisah.'], ['WORDS', 'Dia mengirim pesan berisi kata-kata manis atau penyemangat.']],
  [['TIME', 'Kami melakukan kegiatan bersama, seperti jalan-jalan atau memasak.'], ['GIFTS', 'Dia memberiku kejutan hadiah di hari biasa, tanpa perlu momen khusus.']],
  [['SERVICE', 'Dia mengerjakan tugas rumah tanpa kuminta.'], ['TOUCH', 'Dia menggandeng tanganku saat kami berjalan bersama.']],
  [['WORDS', 'Dia mengatakan bahwa dia bangga padaku.'], ['GIFTS', 'Dia ingat barang yang kuinginkan lalu memberikannya padaku.']],
  [['TIME', 'Dia benar-benar mendengarkan ceritaku sampai selesai.'], ['SERVICE', 'Dia mengurus hal-hal merepotkan supaya aku bisa beristirahat.']],
  [['GIFTS', 'Dia memilih hadiah ulang tahun untukku dengan penuh pertimbangan.'], ['TOUCH', 'Dia merangkul atau menepuk pundakku saat aku sedih.']],
  [['WORDS', 'Dia berterima kasih atas hal-hal kecil yang kulakukan.'], ['SERVICE', 'Dia memasakkan atau menyiapkan makanan untukku.']],
  [['TIME', 'Dia mengosongkan jadwalnya demi menghabiskan hari bersamaku.'], ['TOUCH', 'Dia duduk dekat atau bersandar padaku saat kami bersantai.']],
  [['SERVICE', 'Dia mengantar atau menjemputku saat aku membutuhkannya.'], ['WORDS', 'Dia bilang "aku sayang kamu" tanpa diminta.']],
  [['TOUCH', 'Dia memijat bahuku saat aku lelah.'], ['TIME', 'Kami menikmati momen santai berdua, meski hanya duduk bersama.']],
  [['GIFTS', 'Dia membelikan camilan atau minuman favoritku.'], ['WORDS', 'Dia menyemangatiku dengan kata-kata saat aku ragu pada diriku sendiri.']],
  [['SERVICE', 'Dia memperbaiki atau membereskan sesuatu yang rusak untukku.'], ['TIME', 'Dia menatapku dan fokus penuh saat kami berbicara.']],
  [['TOUCH', 'Dia mengusap punggung atau kepalaku untuk menenangkanku.'], ['GIFTS', 'Dia memberiku benda kecil yang bisa kusimpan sebagai kenangan.']],
  [['WORDS', 'Dia menuliskan surat atau catatan kecil untukku.'], ['TOUCH', 'Dia menyentuh lenganku dengan hangat saat kami berbicara.']],
  [['TIME', 'Dia mengajakku pergi berdua sekadar untuk menghabiskan waktu bersama.'], ['WORDS', 'Dia menyebutkan hal-hal yang dia kagumi dariku.']],
  [['SERVICE', 'Dia menggantikan tugasku saat aku sedang lelah atau sakit.'], ['GIFTS', 'Dia membuatkan sesuatu dengan tangannya sendiri untukku.']],
  [['TOUCH', 'Dia memelukku erat setelah kami lama tidak bertemu.'], ['SERVICE', 'Dia membantu menyiapkan keperluanku sebelum hari yang sibuk.']],
  [['GIFTS', 'Dia pulang dari bepergian dengan membawa sesuatu untukku.'], ['TIME', 'Kami punya waktu khusus berdua yang rutin setiap minggu.']],
];

const MAX_PER_LANG = 8;

export const loveLanguage: SelfTestDefinition = {
  type: 'LOVE_LANGUAGE',
  slug: 'bahasa-cinta',
  theme: 'bahasa-cinta',
  title: 'Bahasa Cinta',
  tagline: 'Cara apa yang paling membuatmu merasa disayangi?',
  description:
    'Setiap orang punya cara berbeda untuk merasakan kasih sayang. Mengenali bahasa cintamu membantumu menyampaikan kebutuhan kepada pasangan, keluarga, atau sahabat.',
  minutes: 4,
  source:
    'Terinspirasi konsep lima bahasa cinta dari Gary Chapman. Butir ditulis khusus untuk Ruang Pulih; bukan kuis resmi "The 5 Love Languages®".',
  prompt: 'Bayangkan orang terdekatmu (pasangan, keluarga, atau sahabat). Mana yang lebih membuatmu merasa disayangi?',
  items: PAIRS.map(([a, b]) => ({
    text: 'Mana yang lebih membuatmu merasa disayangi?',
    options: [
      { value: 0, label: a[1] },
      { value: 1, label: b[1] },
    ],
  })),
  evaluate(answers) {
    const counts: Record<Lang, number> = { WORDS: 0, TIME: 0, GIFTS: 0, SERVICE: 0, TOUCH: 0 };
    PAIRS.forEach((pair, i) => {
      counts[pair[answers[i] === 0 ? 0 : 1][0]] += 1;
    });
    const ranking = (Object.keys(LANGS) as Lang[])
      .map((key) => ({
        key,
        ...LANGS[key],
        score: counts[key],
        max: MAX_PER_LANG,
        percent: Math.round((counts[key] / MAX_PER_LANG) * 100),
      }))
      .sort((a, b) => b.score - a.score);
    const primary = ranking.filter((r) => r.score === ranking[0].score).map((r) => r.name);
    return {
      headline: `Bahasa cinta utama: ${primary.join(' & ')}`,
      result: { ranking, primary },
      facts: {
        tes: 'Bahasa cinta (cara pengguna paling MERASA disayangi oleh orang lain, bukan cara ia menyayangi)',
        utama: primary,
        artiUtama: ranking.filter((r) => primary.includes(r.name)).map((r) => r.description),
        urutanDariTertinggi: ranking.map((r) => `${r.name} ${r.score}/${r.max}`),
        palingRendah: ranking[ranking.length - 1].name,
      },
      slugs: ['pernikahan', 'hubungan-keluarga'],
      safety: 0,
    };
  },
};
