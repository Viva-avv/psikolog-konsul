import type { SelfTestDefinition } from './types';

type Dim = 'EI' | 'SN' | 'TF' | 'JP';
type Choice = [letter: string, text: string];

// Original items written for this app (not the official MBTI® instrument). Five per dimension, so no ties.
const ITEMS: Array<{ dim: Dim; text: string; a: Choice; b: Choice }> = [
  { dim: 'EI', text: 'Setelah seminggu yang melelahkan, cara terbaikku mengisi ulang energi adalah...', a: ['E', 'Bertemu teman atau pergi ke tempat yang ramai'], b: ['I', 'Menghabiskan waktu sendiri atau dengan satu-dua orang dekat'] },
  { dim: 'SN', text: 'Saat mempelajari hal baru, aku lebih suka...', a: ['S', 'Contoh nyata dan langkah-langkah praktis'], b: ['N', 'Gambaran besar dan konsep di baliknya'] },
  { dim: 'TF', text: 'Saat harus mengambil keputusan sulit, aku lebih mengandalkan...', a: ['T', 'Logika dan pertimbangan untung-rugi'], b: ['F', 'Nilai pribadi dan dampaknya pada orang lain'] },
  { dim: 'JP', text: 'Menjelang liburan, aku biasanya...', a: ['J', 'Menyusun rencana dan jadwal sejak jauh hari'], b: ['P', 'Membiarkannya mengalir dan memutuskan di tempat'] },
  { dim: 'EI', text: 'Di acara yang penuh orang baru, aku biasanya...', a: ['I', 'Menunggu diajak bicara atau mengobrol dengan orang yang sudah kukenal'], b: ['E', 'Mudah memulai obrolan dengan siapa saja'] },
  { dim: 'SN', text: 'Aku lebih tertarik pada...', a: ['N', 'Kemungkinan dan ide tentang masa depan'], b: ['S', 'Fakta dan apa yang sedang terjadi sekarang'] },
  { dim: 'TF', text: 'Ketika teman bercerita tentang masalahnya, reaksi pertamaku adalah...', a: ['F', 'Mendengarkan dan menunjukkan bahwa aku memahami perasaannya'], b: ['T', 'Membantunya mencari jalan keluar'] },
  { dim: 'JP', text: 'Tenggat waktu bagiku adalah...', a: ['P', 'Pemicu semangat; aku sering paling produktif menjelang akhir'], b: ['J', 'Sesuatu yang ingin kuselesaikan jauh sebelum waktunya'] },
  { dim: 'EI', text: 'Saat memikirkan sebuah masalah, aku lebih suka...', a: ['E', 'Membicarakannya dengan orang lain sambil berpikir'], b: ['I', 'Merenungkannya sendiri dulu sebelum bercerita'] },
  { dim: 'SN', text: 'Saat menceritakan suatu kejadian, aku cenderung...', a: ['S', 'Menjelaskan detailnya secara berurutan'], b: ['N', 'Menyampaikan makna atau kesan umumnya'] },
  { dim: 'TF', text: 'Aku lebih ingin dikenal sebagai orang yang...', a: ['T', 'Adil dan objektif'], b: ['F', 'Hangat dan penuh pengertian'] },
  { dim: 'JP', text: 'Aku merasa lebih nyaman ketika...', a: ['J', 'Segala sesuatu sudah diputuskan dan pasti'], b: ['P', 'Pilihan masih terbuka dan fleksibel'] },
  { dim: 'EI', text: 'Orang-orang lebih sering menggambarkanku sebagai...', a: ['I', 'Tenang dan butuh waktu untuk terbuka'], b: ['E', 'Ekspresif dan mudah akrab'] },
  { dim: 'SN', text: 'Aku lebih percaya pada...', a: ['N', 'Firasat dan intuisi'], b: ['S', 'Pengalaman yang sudah terbukti'] },
  { dim: 'TF', text: 'Dalam perdebatan, yang lebih penting bagiku adalah...', a: ['F', 'Menjaga hubungan tetap baik'], b: ['T', 'Menemukan jawaban yang paling tepat'] },
  { dim: 'JP', text: 'Meja atau ruang kerjaku biasanya...', a: ['J', 'Rapi dan tertata'], b: ['P', 'Agak berantakan, tapi aku tahu letak barang-barangku'] },
  { dim: 'EI', text: 'Akhir pekan idealku adalah...', a: ['E', 'Penuh rencana bersama banyak orang'], b: ['I', 'Di rumah dengan buku, film, atau hobi pribadi'] },
  { dim: 'SN', text: 'Pekerjaan yang paling menarik bagiku adalah yang...', a: ['S', 'Jelas, terukur, dan hasilnya bisa langsung terlihat'], b: ['N', 'Memberi ruang untuk mencoba cara-cara baru'] },
  { dim: 'TF', text: 'Saat memberi masukan pada orang lain, aku cenderung...', a: ['T', 'Langsung ke inti supaya jelas'], b: ['F', 'Memilih kata dengan hati-hati agar tidak menyakiti'] },
  { dim: 'JP', text: 'Saat rencana berubah mendadak, aku...', a: ['P', 'Mudah menyesuaikan diri, bahkan menikmatinya'], b: ['J', 'Merasa terganggu dan butuh waktu untuk menyesuaikan'] },
];

const DIMENSIONS: Record<Dim, { left: [string, string]; right: [string, string] }> = {
  EI: { left: ['E', 'Ekstrovert'], right: ['I', 'Introvert'] },
  SN: { left: ['S', 'Pengamat'], right: ['N', 'Intuitif'] },
  TF: { left: ['T', 'Pemikir'], right: ['F', 'Perasa'] },
  JP: { left: ['J', 'Terencana'], right: ['P', 'Spontan'] },
};

const TYPES: Record<string, { nickname: string; summary: string; strengths: string[]; growth: string }> = {
  INTJ: { nickname: 'Si Perencana Visioner', summary: 'Kamu suka memikirkan gambaran jangka panjang dan menyusun strategi untuk mewujudkannya. Kamu mandiri dan menghargai kompetensi.', strengths: ['Berpikir strategis', 'Mandiri', 'Tekun mengejar tujuan'], growth: 'Coba bagikan proses berpikirmu lebih awal agar orang lain bisa ikut memahami dan mendukung rencanamu.' },
  INTP: { nickname: 'Si Penjelajah Ide', summary: 'Kamu senang membongkar cara kerja sesuatu dan menguji ide dari berbagai sudut. Rasa ingin tahumu nyaris tak ada habisnya.', strengths: ['Analitis', 'Kreatif dalam berpikir', 'Objektif'], growth: 'Pilih satu ide dan tuntaskan sampai menjadi hasil nyata sebelum beralih ke ide berikutnya.' },
  ENTJ: { nickname: 'Si Penggerak Tujuan', summary: 'Kamu tegas, terarah, dan cepat melihat cara membuat sesuatu lebih efektif. Kamu nyaman memimpin dan mengambil keputusan.', strengths: ['Kepemimpinan', 'Tegas', 'Efisien'], growth: 'Sisihkan waktu untuk menanyakan perasaan tim, bukan hanya kemajuan pekerjaannya.' },
  ENTP: { nickname: 'Si Pendobrak Kreatif', summary: 'Kamu cepat menangkap peluang, suka berdiskusi, dan senang menantang cara-cara lama. Ide segar adalah bahan bakarmu.', strengths: ['Inovatif', 'Cepat beradaptasi', 'Pandai berargumen'], growth: 'Tidak semua diskusi perlu dimenangkan; kadang mendengar lebih lama membuka ide yang lebih baik.' },
  INFJ: { nickname: 'Si Penuntun Bermakna', summary: 'Kamu peka membaca orang dan ingin hidupmu selaras dengan nilai yang kamu yakini. Kamu sering menjadi tempat curhat orang lain.', strengths: ['Empatik', 'Berwawasan', 'Berprinsip'], growth: 'Jaga batasan energimu; merawat diri sendiri sama pentingnya dengan menolong orang lain.' },
  INFP: { nickname: 'Si Idealis Lembut', summary: 'Kamu memegang nilai-nilai pribadi dengan sungguh-sungguh dan punya dunia batin yang kaya. Kamu ingin melakukan hal yang bermakna.', strengths: ['Tulus', 'Kreatif', 'Penuh pengertian'], growth: 'Pecah impian besarmu menjadi langkah kecil yang bisa dimulai hari ini.' },
  ENFJ: { nickname: 'Si Penyemangat Hangat', summary: 'Kamu pandai menyatukan orang dan senang melihat orang lain berkembang. Kehangatanmu membuat orang merasa diterima.', strengths: ['Inspiratif', 'Komunikatif', 'Peduli'], growth: 'Izinkan dirimu menerima bantuan juga; kamu tidak harus selalu menjadi penolong.' },
  ENFP: { nickname: 'Si Pencari Inspirasi', summary: 'Kamu antusias, imajinatif, dan mudah melihat potensi pada orang maupun ide. Kamu membawa semangat ke mana pun kamu pergi.', strengths: ['Antusias', 'Kreatif', 'Mudah akrab'], growth: 'Buat sistem sederhana untuk menindaklanjuti ide agar semangatmu menjadi hasil nyata.' },
  ISTJ: { nickname: 'Si Penjaga Komitmen', summary: 'Kamu bertanggung jawab, teliti, dan memegang janji. Orang lain tahu mereka bisa mengandalkanmu.', strengths: ['Dapat diandalkan', 'Teliti', 'Konsisten'], growth: 'Sesekali cobalah cara baru; fleksibilitas kecil bisa membuka peluang tak terduga.' },
  ISFJ: { nickname: 'Si Perawat Setia', summary: 'Kamu penuh perhatian, setia, dan senang merawat orang-orang terdekat dengan cara yang nyata.', strengths: ['Perhatian', 'Setia', 'Telaten'], growth: 'Sampaikan kebutuhanmu dengan jelas; orang yang menyayangimu ingin tahu cara membalas kebaikanmu.' },
  ESTJ: { nickname: 'Si Penata Andal', summary: 'Kamu praktis, terorganisasi, dan suka memastikan segala sesuatu berjalan sesuai aturan dan rencana.', strengths: ['Terorganisasi', 'Tegas', 'Bertanggung jawab'], growth: 'Beri ruang bagi cara kerja yang berbeda; hasil yang baik tidak selalu lewat jalur yang sama.' },
  ESFJ: { nickname: 'Si Perekat Kebersamaan', summary: 'Kamu hangat, ramah, dan peka terhadap kebutuhan orang di sekitarmu. Kamu senang menciptakan suasana yang harmonis.', strengths: ['Ramah', 'Kooperatif', 'Peduli'], growth: 'Tidak apa-apa jika tidak semua orang senang; pendapatmu sendiri juga penting.' },
  ISTP: { nickname: 'Si Pemecah Masalah Praktis', summary: 'Kamu tenang, logis, dan senang memahami sesuatu dengan langsung mencobanya. Kamu andal saat situasi genting.', strengths: ['Tenang di bawah tekanan', 'Praktis', 'Mandiri'], growth: 'Coba ungkapkan perasaanmu dengan kata-kata; orang terdekat ingin mengenalmu lebih dalam.' },
  ISFP: { nickname: 'Si Seniman Tenang', summary: 'Kamu lembut, peka terhadap keindahan, dan menghargai kebebasan untuk menjadi diri sendiri.', strengths: ['Estetis', 'Rendah hati', 'Peka'], growth: 'Beranilah menyuarakan pendapat; pandanganmu berharga meski disampaikan dengan tenang.' },
  ESTP: { nickname: 'Si Pelaku Sigap', summary: 'Kamu energik, berani, dan suka bertindak cepat. Kamu menikmati tantangan dan pengalaman langsung.', strengths: ['Berani', 'Cepat bertindak', 'Pandai bernegosiasi'], growth: 'Sebelum keputusan besar, beri dirimu jeda sejenak untuk menimbang dampak jangka panjangnya.' },
  ESFP: { nickname: 'Si Penghidup Suasana', summary: 'Kamu ceria, spontan, dan senang membuat orang lain gembira. Kamu hidup sepenuhnya di saat ini.', strengths: ['Menyenangkan', 'Spontan', 'Hangat'], growth: 'Luangkan sedikit waktu untuk merencanakan masa depan tanpa kehilangan keceriaanmu.' },
};

export const sixteenTypes: SelfTestDefinition = {
  type: 'SIXTEEN_TYPES',
  slug: 'tipe-kepribadian',
  theme: 'kepribadian',
  title: '16 Tipe Kepribadian',
  tagline: 'Temukan kode 4 huruf yang menggambarkan preferensimu.',
  description:
    'Melihat empat preferensi: sumber energi (E/I), cara menangkap informasi (S/N), cara mengambil keputusan (T/F), dan gaya menjalani hidup (J/P). Anggap hasilnya sebagai cermin preferensi, bukan kotak yang membatasi.',
  minutes: 4,
  source:
    'Butir dan deskripsi ditulis khusus untuk Ruang Pulih berdasarkan empat dimensi preferensi yang populer. Bukan instrumen MBTI® resmi. Untuk gambaran yang lebih teruji secara ilmiah, coba juga tes Big Five.',
  prompt: 'Pilih yang paling menggambarkan dirimu. Ikuti kecenderungan pertamamu.',
  items: ITEMS.map(({ text, a, b }) => ({
    text,
    options: [
      { value: 0, label: a[1] },
      { value: 1, label: b[1] },
    ],
  })),
  evaluate(answers) {
    const counts: Record<string, number> = {};
    ITEMS.forEach((item, i) => {
      const letter = (answers[i] === 0 ? item.a : item.b)[0];
      counts[letter] = (counts[letter] ?? 0) + 1;
    });
    const dimensions = (Object.keys(DIMENSIONS) as Dim[]).map((key) => {
      const { left, right } = DIMENSIONS[key];
      const leftCount = counts[left[0]] ?? 0;
      const rightCount = counts[right[0]] ?? 0;
      return {
        key,
        letter: leftCount > rightCount ? left[0] : right[0],
        left: { letter: left[0], name: left[1] },
        right: { letter: right[0], name: right[1] },
        leftPercent: Math.round((leftCount / (leftCount + rightCount)) * 100),
      };
    });
    const code = dimensions.map((d) => d.letter).join('');
    const info = TYPES[code];
    return {
      headline: `${code} — ${info.nickname}`,
      result: { code, ...info, dimensions },
      facts: {
        tes: '16 tipe kepribadian (gaya 4 huruf, bukan MBTI resmi)',
        tipe: code,
        julukan: info.nickname,
        ringkasan: info.summary,
        kekuatan: info.strengths,
        preferensi: dimensions.map((d) => ({
          dimensi: `${d.left.name} vs ${d.right.name}`,
          condong: d.letter === d.left.letter ? d.left.name : d.right.name,
          persen: d.letter === d.left.letter ? d.leftPercent : 100 - d.leftPercent,
        })),
      },
      slugs: ['pengembangan-diri'],
      safety: 0,
    };
  },
};
