/**
 * Stage 2 — Personal & Goals. Q01–Q04.
 *
 * v1 shipped these four as Q01, Q02, Q03 and Q06, and printed Q06 after the
 * Stage 3 pages, so the book jumped stages mid-read. The stage now owns four
 * consecutive numbers and four consecutive pages.
 *
 * Every blueprint carries the same five layers, in this order:
 *   hidden  — the question behind the question. The premium layer: it is what a
 *             candidate cannot get from a list of sample answers.
 *   traps / judged — three each, one line each.
 *   cheat   — the framework, drawn.
 *   answer  — one worked answer, tagged by framework step.
 *   pro / arena — one sharpening move, and how a Side Hustle Arena project
 *             plugs into this answer.
 */

export const stage2 = [
  {
    id: "Q01",
    stage: 2,
    title: "Self Introduction",
    question: "Bisa ceritakan tentang diri Anda?",
    tag: "LEARN",
    target: "90 detik",
    level: 1,
    hidden: "Dari seluruh hidup Anda, mana 90 detik yang relevan dengan posisi ini?",
    esensi:
      "HR tidak meminta biografi. Ini tes menyaring informasi — dan tes pertama untuk struktur berpikir Anda di bawah tekanan.",
    traps: [
      "Mulai dari \"Saya lahir di…\"",
      "Mengulang CV kata per kata. Mereka sudah membacanya.",
      "Cerita personal: hobi, pacar, drama keluarga.",
    ],
    judged: [
      "Relevansi: cerita Anda mengarah ke posisi ini.",
      "Kejelasan struktur saat ditanya mendadak.",
      "Bukti kuantitatif, bukan kata sifat.",
    ],
    cheat: {
      name: 'Prinsip "LEARN"',
      kind: "flow",
      nodes: [
        { key: "L", label: "Label", note: "Satu kalimat identitas profesional." },
        { key: "E", label: "Experience", note: "Satu pengalaman paling relevan, dengan angka." },
        { key: "A", label: "Ability", note: "Dua skill teknis, satu soft skill dari jobdesc." },
        { key: "R", label: "Reason", note: "Jembatan: kenapa jalur ini, bukan yang lain." },
        { key: "N", label: "Next Value", note: "Tutup dengan yang mereka dapat, bukan yang Anda cari." },
      ],
      note: "Lewat 2 menit? Potong bagian Experience, bukan bagian Next Value.",
    },
    answer: {
      file: "self_introduction.txt",
      lines: [
        { tag: "L", text: "Saya Alvi, fresh graduate Psikologi Universitas Pendidikan Indonesia, konsentrasi Psikologi Industri &amp; Organisasi." },
        { tag: "E", text: "Enam bulan terakhir saya magang di Human Capital Recruitment sebuah grup agribisnis, menangani <b class=\"hl\">±120 kandidat per bulan</b> dari screening CV sampai interview awal. Saya juga merapikan database kandidat, yang <b class=\"hl\">memangkas waktu screening dari 3 hari jadi 1 hari kerja</b>." },
        { tag: "A", text: "Secara teknis saya terbiasa dengan alat tes psikologi, ATS, dan spreadsheet pelaporan. Kekuatan personal saya di <b class=\"hl-b\">mendengarkan aktif</b> — yang paling sering dipakai saat menggali motivasi kandidat." },
        { tag: "R", text: "Pengalaman itu meyakinkan saya untuk serius di jalur rekrutmen, bukan sekadar mencoba." },
        { tag: "N", text: "Karena itu saya melamar di sini: membawa ketelitian proses dan kecepatan screening yang sudah saya latih ke tim yang sedang agresif melakukan hiring." },
      ],
    },
    pro: "Siapkan dua versi: 90 detik untuk HR, 30 detik untuk user yang buru-buru.",
    arena: "Belum pernah magang? Bagian [E] boleh diisi satu project Arena — sebutkan brief, keputusan Anda, dan skornya.",
  },

  {
    id: "Q02",
    stage: 2,
    title: "Career Choice",
    question: "Kenapa memilih berkarir di bidang ini?",
    tag: "JOBDESC MATCH",
    target: "75 detik",
    level: 2,
    hidden: "Berapa besar kemungkinan Anda resign dalam 12 bulan karena pekerjaannya ternyata tidak seperti bayangan Anda?",
    esensi:
      "Ini pertanyaan tentang risiko turnover. Jawaban yang bagus membuktikan Anda tahu isi pekerjaannya — bukan sekadar menyukai idenya.",
    traps: [
      "\"Saya suka bertemu orang baru.\" Semua orang bilang begitu.",
      "\"Linear dengan jurusan saya.\" Itu alasan administratif.",
      "\"Prospeknya bagus.\" Anda memilih pasar, bukan pekerjaan.",
    ],
    judged: [
      "Pemahaman nyata soal jobdesc harian.",
      "Bukti Anda pernah mencicipi pekerjaannya.",
      "Kesadaran akan sisi tidak menyenangkannya.",
    ],
    cheat: {
      name: "Jobdesc × Experience Match",
      kind: "flow",
      nodes: [
        { key: "01", label: "Trigger", note: "Momen konkret yang mengarahkan Anda ke sini." },
        { key: "02", label: "Reality", note: "Isi pekerjaannya sehari-hari, bukti Anda riset." },
        { key: "03", label: "Proof", note: "Pengalaman Anda yang beririsan dengan jobdesc." },
        { key: "04", label: "Fit", note: "Kenapa tetap memilihnya setelah tahu sisi beratnya." },
      ],
      note: "Kunci pembeda: sebut tiga tanggung jawab spesifik dari job description, lalu pasangkan masing-masing dengan satu pengalaman Anda.",
      table: {
        head: ["Poin jobdesc", "Pengalaman Anda", "Hasil"],
        rows: [
          ["End-to-end recruitment", "Magang HC, 6 bulan", "120 kandidat/bulan"],
          ["Stakeholder coordination", "Ketua divisi acara kampus", "9 divisi, 400 peserta"],
          ["Reporting &amp; data", "Skripsi kuantitatif + SPSS", "Terbiasa baca data mentah"],
        ],
      },
    },
    answer: {
      file: "career_choice.txt",
      lines: [
        { tag: "TRIGGER", text: "Ketertarikan saya mulai serius saat jadi panitia rekrutmen anggota baru organisasi kampus. Saya sadar satu hal: <b class=\"hl\">keputusan memilih orang punya efek jangka panjang</b> ke seluruh tim." },
        { tag: "REALITY", text: "Dari job description posisi ini, ada tiga tanggung jawab utama: rekrutmen end-to-end, koordinasi dengan user, dan laporan rekrutmen berkala." },
        { tag: "PROOF", text: "Ketiganya sudah saya sentuh saat magang: screening sampai interview awal, koordinasi dengan tiga user berbeda divisi, dan <b class=\"hl\">laporan pipeline mingguan</b>." },
        { tag: "FIT", text: "Saya juga sadar sisi beratnya — administratif, repetitif, penuh kandidat yang tiba-tiba menghilang. Saya tetap memilihnya karena bagian yang saya nikmati justru <b class=\"hl\">menemukan orang yang tepat di tempat yang tepat</b>." },
      ],
    },
    pro: "Sebut satu sisi berat pekerjaannya. Kandidat yang tahu bagian tidak enaknya terdengar jauh lebih kredibel.",
    arena: "Satu project Arena selesai = satu bukti Anda pernah mencicipi pekerjaannya, bukan hanya membayangkannya.",
  },

  {
    id: "Q03",
    stage: 2,
    title: "Target Company",
    question: "Kenapa tertarik bergabung di perusahaan kami?",
    tag: "VALUES + SDGs",
    target: "75 detik",
    level: 2,
    hidden: "Anda melamar ke perusahaan ini, atau ke seratus perusahaan sekaligus?",
    esensi:
      "Ini tes culture fit. Nilai yang Anda sebut akan dicocokkan dengan nilai yang mereka pegang — jadi sebut yang bisa Anda buktikan dengan perilaku.",
    traps: [
      "\"Perusahaan besar dan terkenal.\" Anda mengagumi ukuran.",
      "\"Gajinya kompetitif.\" Jujur, tapi bunuh diri di tahap ini.",
      "Menyalin visi-misi dari website tanpa tahu artinya.",
    ],
    judged: [
      "Kedalaman riset: produk, pasar, arah bisnis.",
      "Kecocokan nilai personal dengan nilai perusahaan.",
      "Kontribusi yang Anda berikan, bukan hanya yang Anda dapat.",
    ],
    cheat: {
      name: "Core Values × SDGs Alignment",
      kind: "flow",
      nodes: [
        { key: "01", label: "Lapis bisnis", note: "Satu produk spesifik dan satu langkah bisnis terbaru mereka." },
        { key: "02", label: "Lapis nilai", note: "Satu core value, diterjemahkan jadi perilaku nyata Anda." },
        { key: "03", label: "Lapis dampak", note: "Kaitkan ke SDG yang relevan, misal #4 Quality Education." },
      ],
      note: "Hindari klise \"ingin bermanfaat bagi banyak orang\". Ganti dengan satu cerita sepanjang dua kalimat.",
    },
    answer: {
      file: "target_company.txt",
      lines: [
        { tag: "BISNIS", text: "Saya mengikuti ekspansi program pelatihan vokasi yang diluncurkan tahun lalu. Itu menunjukkan arah pertumbuhan yang bertumpu pada <b class=\"hl\">pengembangan manusia</b>, bukan hanya penjualan." },
        { tag: "NILAI", text: "Salah satu core values perusahaan adalah <b class=\"hl\">integritas dalam proses</b>. Buat saya itu bukan kata-kata di dinding: waktu magang saya menahan satu kandidat kuat karena ada ketidaksesuaian data di CV-nya, meski prosesnya jadi molor seminggu." },
        { tag: "DAMPAK", text: "Kontribusi perusahaan pada <b class=\"hl-b\">SDG #4, Quality Education</b> beririsan langsung dengan alasan saya masuk Psikologi: membantu orang menemukan jalur yang tepat sejak awal." },
        { tag: "FIT", text: "Jadi ketertarikan saya bukan pada besarnya perusahaan, tapi pada kesamaan arah — dan saya ingin ikut mengerjakannya dari fungsi rekrutmen." },
      ],
    },
    pro: "Satu cerita integritas yang merugikan Anda sendiri lebih meyakinkan daripada tiga kalimat memuji perusahaan.",
    arena: "Cek laman karier dan LinkedIn mereka H-1. Berita tiga bulan terakhir lebih bernilai daripada tahun berdiri.",
  },

  {
    id: "Q04",
    stage: 2,
    title: "Company Research",
    question: "Apa yang Anda ketahui tentang perusahaan kami?",
    tag: "RESEARCH MATRIX",
    target: "60 detik",
    level: 1,
    hidden: "Seberapa serius Anda menyiapkan diri untuk pertemuan hari ini?",
    esensi:
      "Pertanyaan paling mudah dijawab dan paling sering digagalkan. Yang menang bukan yang hafal profil, tapi yang menyebut satu berita terbaru dan tahu artinya bagi bisnis.",
    traps: [
      "Menghafal tahun berdiri dan nama pendiri saja.",
      "Memuji berlebihan tanpa substansi.",
      "Salah menyebut produk atau lini bisnis — fatal.",
    ],
    judged: [
      "Kedalaman dan kebaruan riset.",
      "Kemampuan menghubungkan info bisnis ke peran Anda.",
      "Rasa ingin tahu yang tulus.",
    ],
    cheat: {
      name: "4-Quadrant Research Matrix",
      kind: "quad",
      nodes: [
        { key: "History", label: "Asal usul, tonggak, arah transformasi", note: "Website resmi, laporan tahunan" },
        { key: "Product", label: "Lini utama, produk unggulan, penggunanya", note: "Halaman produk, marketplace, ulasan" },
        { key: "Market", label: "Posisi vs kompetitor, tantangan industri", note: "Media bisnis, laporan industri, LinkedIn" },
        { key: "News", label: "Ekspansi, penghargaan, kebijakan 3–6 bulan", note: "Google News, akun resmi, siaran pers" },
      ],
      note: "Rumus penutup: ambil satu temuan dari kuadran News, lalu tarik ke peran Anda.",
    },
    answer: {
      file: "company_research.txt",
      lines: [
        { tag: "HISTORY", text: "Perusahaan ini berdiri di sektor agribisnis dan dalam satu dekade terakhir bergerak ke <b class=\"hl\">hilirisasi produk konsumen</b>." },
        { tag: "PRODUCT", text: "Lini yang paling saya kenal produk konsumsi rumah tangga, distribusinya dari pasar tradisional sampai ritel modern." },
        { tag: "MARKET", text: "Di segmen itu kompetisinya ketat dengan dua pemain besar lain, dan pembedanya ada di rantai pasok yang terintegrasi dari hulu." },
        { tag: "NEWS", text: "Beberapa bulan terakhir ada <b class=\"hl\">pembukaan fasilitas produksi baru</b> yang diberitakan cukup luas." },
        { tag: "LINK", text: "Buat saya itu berarti satu hal konkret: <b class=\"hl\">kebutuhan perekrutan akan naik dalam 1–2 tahun</b>, dan tim rekrutmen jadi fungsi yang genting. Di situ saya ingin berkontribusi." },
      ],
    },
    pro: "Kalimat terakhir wajib menyambung temuan riset ke posisi yang Anda lamar. Tanpa itu, Anda cuma membacakan profil perusahaan.",
    arena: "Kalau produknya bisa dicoba, coba dulu. Satu kalimat pengalaman memakai produk mereka mengalahkan sepuluh kalimat hasil googling.",
  },
];
