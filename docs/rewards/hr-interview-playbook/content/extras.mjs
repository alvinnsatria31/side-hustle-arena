/**
 * Everything that is not one of the twelve blueprints: stage metadata, the
 * cover, the index, Stage 1's rules, the new Boss Stage, the story-bank
 * worksheet and the closing pages.
 *
 * The Boss Stage is new in v2. v1 never covered the three questions candidates
 * actually lose offers on — weakness, salary expectation, and thin experience —
 * and buried the reverse questions in a corner of the last page.
 */

export const meta = {
  title: "HR Interview",
  titleOutline: "Cheat Code",
  titleTail: "& Frameworks",
  version: "v2.0",
  subtitle:
    "12 blueprint jawaban, metode STAR/CAR/PAR, dan empat pertanyaan penentu — untuk fresh graduate dan early-career professional.",
  author: "Sekolah Karir Editorial Team",
  site: "sekolahkarir.id",
  arena: "Hadiah Side Hustle Arena",
};

export const stages = {
  1: { name: "Intro & Mindset", accent: "var(--amber)" },
  2: { name: "Personal & Goals", accent: "var(--blue)" },
  3: { name: "Behavioral & Team", accent: "var(--teal)" },
  4: { name: "Pressure & Decision", accent: "var(--violet)" },
  5: { name: "Boss Stage", accent: "var(--coral)" },
  6: { name: "Toolkit", accent: "var(--mint)" },
};

/** How to read the book, printed on the index page. */
export const howToUse = {
  layers: [
    { key: "01", label: "Pertanyaan tersembunyi", note: "Apa yang sebenarnya sedang diukur HR." },
    { key: "02", label: "Cheat code", note: "Kerangka jawabannya, digambar." },
    { key: "03", label: "Meaty answer", note: "Satu contoh jadi yang sudah terisi." },
  ],
  routes: [
    { key: "Interview besok", note: "Stage 1, lalu Q01–Q03, lalu halaman terakhir. 25 menit." },
    { key: "Punya satu minggu", note: "Satu stage per hari, isi Story Bank di akhir tiap sesi." },
    { key: "Sudah pernah ditolak", note: "Mulai dari Boss Stage dan Q12, lalu ulang stage yang paling lemah." },
  ],
  rules: [
    "Jangan hafalkan contoh jawabannya. Ambil strukturnya, isi dengan data Anda sendiri — HR bisa mencium jawaban hafalan dari detik ketiga.",
    "Latih dengan timer. Target 60–120 detik per jawaban; lebih dari itu Anda kehilangan ruangan.",
    "Semua contoh di buku ini memakai satu kandidat fiktif bernama Alvi, supaya Anda bisa melihat satu orang yang sama dilihat dari dua belas sudut.",
  ],
};

/** Stage 1, page one. */
export const pauseRule = {
  title: "Aturan Jeda",
  lead:
    "Ketika muncul pertanyaan yang tidak Anda antisipasi, diam beberapa detik itu wajar dan profesional. Yang tidak profesional adalah mengisi keheningan dengan \"a… e… a… e…\".",
  steps: [
    { key: "01", label: "Stall", note: "\"Pertanyaan yang menarik, boleh saya ambil waktu sebentar?\"" },
    { key: "02", label: "Confirm", note: "\"Jadi maksudnya konteks tim atau konteks personal ya, Pak/Bu?\"" },
    { key: "03", label: "Structure", note: "\"Saya jawab dalam dua poin: situasinya dulu, lalu keputusan saya.\"" },
  ],
  note: "Efeknya: Anda terlihat berpikir, bukan panik. Jeda tiga sampai lima detik sudah cukup; sampai sepuluh detik masih aman selama diisi salah satu kalimat di atas.",
};

export const confidenceMatrix = {
  title: "Pede vs Arogan",
  lead: "Batasnya tipis, tapi ada rumusnya: percaya diri bicara tentang bukti, arogan bicara tentang diri sendiri.",
  rows: [
    [
      "\"Saya yang paling berprestasi di angkatan saya.\"",
      "\"Saya memimpin tim 5 orang dan IPK saya 3.72 — tapi yang paling saya pelajari justru dari proyek yang gagal.\"",
    ],
    [
      "\"Tim saya waktu itu lemah, jadi saya handle semuanya.\"",
      "\"Beban tim tidak merata, jadi saya usulkan pembagian ulang tugas berdasarkan kekuatan masing-masing.\"",
    ],
    [
      "\"Saya bisa semua hal, tinggal kasih saja.\"",
      "\"Saya kuat di analisis data; untuk public speaking saya masih membangun jam terbang lewat organisasi.\"",
    ],
    ["Memotong pertanyaan interviewer.", "Menunggu pertanyaan selesai, lalu menjawab tepat sasaran."],
  ],
};

/**
 * Stage 1, page one, third card. The four moments where candidates freeze and
 * start apologising — each with the sentence that buys back control.
 */
export const rescueLines = {
  title: "Kalimat Penyelamat",
  lead: "Empat momen yang membuat kandidat panik, dan kalimat yang mengembalikan kendali.",
  rows: [
    [
      "Anda tidak tahu jawabannya",
      "\"Saya belum pernah menangani itu langsung. Yang paling dekat pernah saya kerjakan adalah [X], dan pendekatan saya akan…\"",
    ],
    [
      "Lupa di tengah cerita",
      "\"Sebentar, saya rapikan dulu — inti yang mau saya sampaikan sebenarnya [satu kalimat].\"",
    ],
    [
      "Ditanya hal teknis di luar keahlian",
      "\"Itu di luar bidang saya, tapi saya tahu siapa yang biasanya menangani dan bagaimana saya akan mencari tahunya.\"",
    ],
    [
      "Interviewer diam setelah jawaban Anda",
      "\"Apakah jawaban saya sudah menjawab yang Bapak/Ibu maksud, atau perlu saya perdalam di bagian tertentu?\"",
    ],
  ],
  note: "Yang dinilai bukan apakah Anda tahu segalanya, tapi apa yang Anda lakukan saat tidak tahu.",
};

/** Stage 1, page two. */
export const presence = {
  title: "Executive Presence",
  lead: "Tiga hal yang dinilai sebelum kalimat pertama Anda selesai.",
  columns: [
    {
      key: "Intonasi",
      items: [
        "Turunkan nada di akhir kalimat — nada naik terdengar ragu.",
        "Tempo sedang. Gugup membuat cepat, cepat membuat tidak terdengar.",
        "Beri jeda sebelum poin penting.",
      ],
    },
    {
      key: "Gestur",
      items: [
        "Tangan terlihat, di atas meja, gerak dalam radius bahu.",
        "Kontak mata 60–70%, bukan menatap tanpa henti.",
        "Punggung tegak, bahu turun, jangan bersandar penuh.",
      ],
    },
    {
      key: "Filler killer",
      bad: true,
      items: [
        "\"a… e… anu…\" — ganti dengan diam.",
        "\"kayaknya\", \"mungkin ya\" — melemahkan klaim.",
        "\"cuma\", \"sekadar\" — mengecilkan pencapaian Anda.",
      ],
    },
  ],
};

export const prep = {
  title: "Checklist Persiapan",
  groups: [
    {
      key: "H-1",
      items: [
        "Riset perusahaan: sejarah, produk, pasar, berita tiga bulan terakhir.",
        "Siapkan lima cerita STAR yang bisa didaur ulang untuk dua belas pertanyaan.",
        "Siapkan dua pertanyaan balik dari Boss Stage.",
      ],
    },
    {
      key: "H-0",
      items: [
        "Latih tiga jawaban pembuka dengan timer di depan kamera ponsel.",
        "Tonton ulang, hitung filler word, ulangi sekali.",
        "Datang 15 menit awal. Online: tes audio, cahaya dari depan, latar bersih.",
      ],
    },
  ],
};

/** Stage 1, page two: the online-interview setup most candidates get wrong. */
export const onlineSetup = {
  title: "Interview Online",
  lead: "Empat hal yang membuat kandidat terlihat tidak siap padahal jawabannya bagus.",
  items: [
    { key: "Kamera", note: "Setinggi mata, bukan dari bawah. Tumpuk laptop dengan buku kalau perlu." },
    { key: "Cahaya", note: "Sumber cahaya di depan wajah. Jendela di belakang membuat Anda jadi siluet." },
    { key: "Audio", note: "Earphone berkabel lebih aman daripada speaker laptop. Tes rekam 10 detik dulu." },
    { key: "Latar", note: "Dinding polos, notifikasi mati, dan beri tahu orang rumah jam berapa Anda mulai." },
  ],
  note: "Masuk ruang meeting 10 menit lebih awal, lalu matikan mikrofon sampai interviewer datang.",
};

/** Boss Stage — the four questions v1 left out. */
export const bossQuestions = [
  {
    id: "B1",
    title: "Kelemahan Anda",
    question: "Apa kelemahan terbesar Anda?",
    hidden: "Anda sadar diri, dan sudah melakukan sesuatu soal itu?",
    esensi:
      "Jebakannya bukan mengaku lemah, tapi memilih kelemahan yang salah. Pilih yang nyata, bukan inti dari pekerjaan ini, dan sudah Anda perbaiki.",
    steps: [
      { key: "01", label: "Nyata", note: "Kelemahan betulan, bukan pujian yang disamarkan." },
      { key: "02", label: "Bukan inti", note: "Jangan sebut skill utama yang diminta jobdesc." },
      { key: "03", label: "Perbaikan", note: "Langkah konkret, plus posisi Anda sekarang." },
    ],
    traps: [
      "\"Saya perfeksionis.\" HR sudah dengar ratusan kali.",
      "\"Saya terlalu keras bekerja.\" Pujian menyamar.",
      "Menyebut kelemahan yang justru inti pekerjaannya.",
    ],
    answer:
      "Saya cenderung mengambil terlalu banyak tugas sekaligus karena sulit bilang tidak. Waktu magang itu membuat dua laporan saya molor. Sejak itu saya memakai satu daftar prioritas mingguan yang saya konfirmasi ke supervisor tiap Senin — tiga bulan terakhir tidak ada lagi tenggat yang lewat, meski saya masih harus sadar menahan diri saat ada permintaan baru.",
  },
  {
    id: "B2",
    title: "Ekspektasi Gaji",
    question: "Berapa ekspektasi gaji Anda?",
    hidden: "Anda tahu harga pasar untuk peran ini, atau menebak?",
    esensi:
      "Menyebut angka terlalu rendah membuat Anda terlihat tidak riset, terlalu tinggi membuat Anda keluar dari daftar. Jawab dengan rentang hasil riset, lalu tanyakan komponennya.",
    steps: [
      { key: "01", label: "Riset", note: "Cek rentang pasar: JobStreet, Glints, LinkedIn Salary, teman seangkatan." },
      { key: "02", label: "Rentang", note: "Sebut rentang, bukan satu angka. Batas bawahnya angka yang Anda terima." },
      { key: "03", label: "Ruang", note: "Tanyakan struktur totalnya sebelum mengunci angka." },
    ],
    traps: [
      "\"Berapa saja, Pak/Bu.\" Anda menyerahkan posisi tawar.",
      "Menyebut angka tanpa tahu itu gaji pokok atau total.",
      "Menyebut kebutuhan pribadi sebagai alasan besaran.",
    ],
    answer:
      "Dari riset saya untuk posisi setara di kota ini, rentangnya sekitar [angka bawah]–[angka atas] per bulan, dan saya ada di rentang itu. Sebelum mengunci angka, boleh saya tahu struktur totalnya — apakah sudah termasuk tunjangan dan bonus? Kalau paket keseluruhannya masuk, saya fleksibel.",
    note: "Isi rentangnya dengan hasil riset Anda sendiri; angka nasional berubah tiap tahun dan berbeda jauh antar kota.",
  },
  {
    id: "B3",
    title: "Pengalaman Minim",
    question: "Pengalaman kerja Anda masih sedikit. Kenapa kami harus menerima Anda?",
    hidden: "Kalau belum ada jam terbang, apa bukti bahwa Anda bisa mengerjakannya?",
    esensi:
      "Jangan minta maaf dan jangan membesar-besarkan. Akui kondisinya dalam satu kalimat, lalu ganti kata \"pengalaman\" dengan \"bukti\".",
    steps: [
      { key: "01", label: "Akui singkat", note: "Satu kalimat, tanpa minta maaf berulang." },
      { key: "02", label: "Tunjukkan bukti", note: "Project, magang, organisasi, freelance — yang ada hasilnya." },
      { key: "03", label: "Angka + kecepatan", note: "Satu angka, plus bukti Anda belajar cepat." },
    ],
    traps: [
      "\"Saya memang belum punya pengalaman, tapi saya mau belajar.\" Berhenti di niat.",
      "Menyebut pengalaman yang tidak bisa dibuktikan.",
      "Menutupi dengan istilah besar tanpa hasil konkret.",
    ],
    answer:
      "Betul, pengalaman formal saya baru enam bulan magang. Tapi yang relevan dengan posisi ini sudah saya kerjakan: [project], dengan [hasil berangka]. Saya juga terbiasa masuk ke masalah yang briefnya belum jelas dan menyelesaikannya dalam tenggat mingguan — itu pola kerja yang sama dengan yang saya lihat di jobdesc ini.",
    note: "Ini pertanyaan yang paling banyak menjatuhkan fresh graduate. Portofolio project mengubahnya jadi pertanyaan termudah.",
  },
  {
    id: "B4",
    title: "Pertanyaan Balik",
    question: "Ada pertanyaan untuk kami?",
    hidden: "Anda sedang mengevaluasi kami juga, atau sekadar ingin diterima di mana saja?",
    esensi:
      "\"Tidak ada, sudah jelas semua\" adalah jawaban terburuk di seluruh interview. Siapkan empat, tanyakan dua yang belum terjawab.",
    steps: [
      { key: "01", label: "Tentang peran", note: "\"Seperti apa gambaran 3 bulan pertama yang dianggap berhasil?\"" },
      { key: "02", label: "Tentang tim", note: "\"Tantangan terbesar tim ini dalam waktu dekat apa?\"" },
      { key: "03", label: "Tentang cara kerja", note: "\"Bagaimana feedback biasanya diberikan di tim ini?\"" },
    ],
    traps: [
      "\"Tidak ada.\" Terbaca tidak tertarik.",
      "Bertanya hal yang sudah dijelaskan di awal.",
      "Membuka soal gaji dan cuti di tahap HR, kecuali mereka yang membuka.",
    ],
    answer:
      "Pertanyaan penutup yang aman dan berguna: \"Setelah hari ini, seperti apa tahap berikutnya dan kira-kira kapan saya bisa menanyakan kabarnya?\" Anda dapat kepastian proses tanpa terdengar menuntut.",
    askThese: [
      "\"Kalau saya diterima, apa yang paling ingin Bapak/Ibu lihat selesai di bulan pertama?\"",
      "\"Bagaimana biasanya orang di posisi ini berkembang setelah satu-dua tahun?\"",
      "\"Apa yang membuat orang sebelumnya berhasil — atau tidak bertahan — di posisi ini?\"",
    ],
    saveForLater: [
      "Besaran gaji dan tunjangan — tunggu tahap penawaran.",
      "Cuti, WFH, jam kerja fleksibel — tanyakan setelah ada tawaran.",
      "Kapan bisa naik jabatan — terdengar terburu-buru di interview pertama.",
    ],
  },
];

/** Story bank worksheet: five stories that answer every behavioral question. */
export const storyBank = {
  title: "Story Bank",
  lead:
    "Lima cerita ini bisa didaur ulang untuk hampir semua pertanyaan di buku ini. Isi sekarang, sebelum Anda butuh.",
  stories: [
    { key: "01", label: "Kepemimpinan", covers: "Q05, Q11" },
    { key: "02", label: "Konflik yang selesai baik", covers: "Q06" },
    { key: "03", label: "Kegagalan + perbaikannya", covers: "Q09, B1" },
    { key: "04", label: "Inisiatif tanpa disuruh", covers: "Q08, Q09" },
    { key: "05", label: "Hasil terukur dengan angka", covers: "Q01, Q07, B3" },
  ],
  fields: ["Situasi & peran saya", "Tindakan (pakai kata kerja)", "Angka / hasil"],
  note:
    "Satu cerita boleh dipakai untuk beberapa pertanyaan — yang berubah hanya bagian mana yang Anda tonjolkan.",
};

/** Closing page. */
export const closing = {
  title: "Sebelum Anda Masuk Ruangan",
  followUp: {
    title: "Setelah keluar ruangan",
    lead:
      "Kirim dalam 24 jam, ke email HR yang menghubungi Anda. Pendek saja — tujuannya mengingatkan, bukan melobi.",
    lines: [
      { tag: "SUBJEK", text: "Terima kasih &mdash; [Nama Anda], [Posisi]" },
      { tag: "ISI", text: "Terima kasih untuk waktunya hari ini, Bapak/Ibu [Nama]. Obrolan soal <b class=\"hl\">[satu hal spesifik dari interview]</b> membuat saya makin yakin dengan posisi ini." },
      { tag: "NILAI", text: "Menyambung pertanyaan tadi soal [topik], saya melampirkan [contoh kerja / catatan singkat] yang mungkin berguna." },
      { tag: "TUTUP", text: "Saya tunggu kabar tahap berikutnya. Kalau ada yang perlu saya lengkapi, dengan senang hati saya siapkan." },
    ],
    note: "Satu email. Kalau belum ada kabar sampai tanggal yang mereka sebut, boleh menyusul sekali lagi.",
  },
  scorecard: {
    title: "Skor jawaban Anda sendiri",
    lead: "Rekam satu jawaban, putar ulang, centang yang terpenuhi. Di bawah empat, ulangi.",
    items: [
      "Ada minimal satu angka.",
      "Jelas mana bagian saya, mana bagian tim.",
      "Ada satu keputusan sulit yang saya ambil.",
      "Durasi 60–120 detik.",
      "Tidak lebih dari tiga filler word.",
      "Ditutup pembelajaran, bukan pujian pada diri sendiri.",
    ],
  },
  notes: [
    "Framework itu kerangka, bukan naskah. Kalau Anda terdengar seperti membaca, semua persiapan ini berbalik melawan Anda.",
    "Ditolak bukan berarti Anda tidak kompeten. Sering kali itu soal kecocokan kebutuhan di waktu tertentu. Minta umpan balik, perbaiki satu hal, lanjut ke pintu berikutnya.",
    "Yang paling menentukan tetap sederhana: datang dengan bukti, bicara dengan struktur, jujur soal batas kemampuan Anda.",
  ],
};
