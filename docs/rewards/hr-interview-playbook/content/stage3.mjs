/**
 * Stage 3 — Behavioral & Team. Q05–Q08.
 *
 * These four are where a story gets told, so each one names the delivery format
 * (STAR, CAR or PAR) it works best with. The master template for all three
 * lives at Q12.
 */

export const stage3 = [
  {
    id: "Q05",
    stage: 3,
    title: "Teamwork Experience",
    question: "Bagaimana pengalaman Anda bekerja dalam tim?",
    tag: "TEAMWORK WHEEL",
    target: "90 detik",
    level: 2,
    hidden: "Di dalam tim, Anda penggerak, perekat, atau penyelesai — dan bisakah Anda memberi kredit ke orang lain?",
    esensi:
      "Semua orang mengaku bisa bekerja dalam tim. Yang dicari adalah peran spesifik Anda di dalamnya, dan apa yang tim perbaiki setelah selesai.",
    traps: [
      "Terus memakai \"saya\" untuk kerja kolektif.",
      "Terus memakai \"kami\" sampai kontribusi Anda hilang.",
      "Menyalahkan anggota lain supaya terlihat lebih baik.",
    ],
    judged: [
      "Kesadaran peran dan porsi kontribusi.",
      "Cara Anda menangani anggota yang pasif.",
      "Hasil tim yang terukur.",
    ],
    cheat: {
      name: "5-Stage Teamwork Wheel",
      kind: "cycle",
      nodes: [
        { key: "01", label: "Purpose", note: "Target tim dan peran Anda. Selalu buka dari sini." },
        { key: "02", label: "Collaboration", note: "Cara informasi mengalir: tools, ritme, pembagian beban." },
        { key: "03", label: "Decision", note: "Siapa yang memutuskan saat beda pendapat, atas dasar apa." },
        { key: "04", label: "Commitment", note: "Cara menjaga tim jalan saat energi turun." },
        { key: "05", label: "Learning", note: "Apa yang tim perbaiki setelahnya." },
      ],
      note: "Rumus kata ganti: \"Timnya melakukan X, bagian saya adalah Y.\" Bagian Learning paling sering dilupakan kandidat — dan paling disukai HR.",
    },
    answer: {
      file: "teamwork.txt",
      lines: [
        { tag: "PURPOSE", text: "Pengalaman tim paling menantang saya: koordinator acara kampus dengan <b class=\"hl\">9 divisi dan 400 peserta</b>. Peran saya menjaga semua divisi bergerak di satu timeline." },
        { tag: "COLLAB", text: "Saya menetapkan satu papan kerja bersama dan rapat 20 menit tiap Senin — sengaja singkat supaya orang datang." },
        { tag: "DECISION", text: "Saat divisi acara dan divisi dana berselisih soal anggaran, saya minta keduanya menyiapkan angka. Keputusan diambil berdasarkan <b class=\"hl\">data penjualan tiket, bukan siapa yang paling keras bicara</b>." },
        { tag: "COMMIT", text: "Dua minggu menjelang hari-H, dua anggota mulai menghilang. Saya bicara empat mata: beban kuliah mereka menumpuk. Tugasnya saya redistribusi, bukan saya paksakan." },
        { tag: "LEARNING", text: "Acara berjalan dengan <b class=\"hl\">kehadiran 92% dari target</b>. Evaluasinya: sejak awal kami harus memetakan kapasitas orang, bukan hanya membagi tugas rata." },
      ],
    },
    pro: "Sebut satu nama peran rekan Anda dan kontribusinya. Kandidat yang memberi kredit terbaca lebih senior, bukan lebih lemah.",
    arena: "Project Arena dikerjakan sendiri, tapi review dan revisi tetap kerja dua arah — itu sah jadi cerita kolaborasi.",
  },

  {
    id: "Q06",
    stage: 3,
    title: "Conflict Resolution",
    question: "Bagaimana cara Anda mengatasi konflik?",
    tag: "5C + PAR",
    target: "90 detik",
    level: 3,
    hidden: "Kalau ada yang tidak beres di tim, Anda membereskannya atau mendiamkannya sampai membesar?",
    esensi:
      "Yang HR takutkan bukan Anda pernah berkonflik, tapi Anda menghindarinya. \"Saya orangnya tidak pernah konflik\" adalah tanda bahaya, bukan nilai plus.",
    traps: [
      "\"Saya selalu mengalah demi kedamaian.\" Pasif.",
      "Menceritakan konflik personal, bukan konflik kerja.",
      "Menjelekkan lawan bicara di dalam cerita Anda.",
    ],
    judged: [
      "Regulasi emosi saat tertekan.",
      "Kemampuan memisahkan masalah dari orangnya.",
      "Apakah hubungan kerja tetap utuh setelahnya.",
    ],
    cheat: {
      name: "Pendekatan 5C",
      kind: "flow",
      nodes: [
        { key: "C1", label: "Listen", note: "Dengar sampai selesai sebelum membela diri." },
        { key: "C2", label: "Consider", note: "Cari kepentingan di balik posisinya." },
        { key: "C3", label: "Calm", note: "Turunkan tensi: pindah forum, turunkan suara." },
        { key: "C4", label: "Check", note: "Uji dengan data, bukan asumsi." },
        { key: "C5", label: "Cooperate", note: "Rumuskan solusi yang dua pihak bisa jalankan." },
      ],
      note: "Sampaikan dengan format PAR — Problem, Action, Result. Paling pas untuk konflik karena menaruh masalah di depan tanpa konteks panjang.",
    },
    answer: {
      file: "conflict_resolution.txt (PAR)",
      lines: [
        { tag: "PROBLEM", text: "Saat magang, saya dan seorang rekan berselisih soal urutan prioritas kandidat. Dia mendahulukan IPK tertinggi, saya mendahulukan pengalaman paling relevan. Diskusinya sempat memanas di grup chat." },
        { tag: "ACTION", text: "Saya berhenti membalas di grup dan mengajaknya bicara langsung. Saya <b class=\"hl\">dengarkan dulu alasannya sampai habis</b> — ternyata kekhawatirannya user sering menolak kandidat ber-IPK rendah. Lalu saya tawarkan uji cepat: ambil <b class=\"hl\">10 kandidat terakhir yang lolos user</b>, lihat polanya." },
        { tag: "RESULT", text: "Datanya menunjukkan pengalaman relevan lebih menentukan, tapi IPK memang penyaring awal user tertentu. Kami sepakat memakai <b class=\"hl\">dua kriteria berurutan</b>, bukan salah satu. Prosesnya lebih cepat, dan hubungan kerja kami justru lebih enak." },
      ],
    },
    pro: "Tutup dengan kondisi hubungan kerja setelah konflik. Itu bagian yang paling sering ditunggu HR dan paling sering tidak diceritakan.",
    arena: "Feedback reviewer yang Anda tidak setujui juga konflik kecil. Cara Anda menanggapinya bisa jadi cerita.",
  },

  {
    id: "Q07",
    stage: 3,
    title: "Defining Success",
    question: "Bagaimana Anda menilai kesuksesan dalam pekerjaan?",
    tag: "OKR × KPI",
    target: "75 detik",
    level: 2,
    hidden: "Kalau atasan Anda memberi target, Anda akan mengukur diri dengan angka atau dengan perasaan?",
    esensi:
      "Kandidat yang mengukur sukses dari perasaan sulit dikelola. Yang bicara angka terbaca sebagai orang yang siap masuk sistem performance management.",
    traps: [
      "\"Sukses itu kalau saya bahagia menjalaninya.\" Tidak terukur.",
      "Menyamakan sukses dengan promosi cepat.",
      "Hanya bicara output pribadi, mengabaikan dampak ke tim.",
    ],
    judged: [
      "Orientasi hasil dan literasi metrik.",
      "Keselarasan target personal dengan target organisasi.",
      "Kesadaran soal kualitas, bukan sekadar kuantitas.",
    ],
    cheat: {
      name: "OKR & KPI Alignment",
      kind: "okr",
      nodes: [
        { key: "Objective", label: "Arah", note: "Proses rekrutmen yang cepat TAPI tepat." },
        { key: "Key Results", label: "Angka", note: "Time-to-hire turun 30%. Delapan posisi terisi per kuartal." },
        { key: "KPI", label: "Kesehatan proses", note: "Kualitas hire: retensi di tiga bulan pertama." },
      ],
      note: "Selalu pasangkan satu metrik kecepatan dengan satu metrik kualitas. Itu menunjukkan Anda paham angka bisa menipu.",
      levels: [
        { key: "Level 1 — Diri", note: "Target yang Anda tetapkan sendiri, dengan angka dan tenggat." },
        { key: "Level 2 — Tim", note: "Apakah hasil Anda memudahkan pekerjaan orang lain." },
        { key: "Level 3 — Organisasi", note: "Sambungannya ke tujuan besar perusahaan." },
      ],
    },
    answer: {
      file: "defining_success.txt",
      lines: [
        { tag: "PRINSIP", text: "Buat saya, sukses itu ketika pekerjaan saya <b class=\"hl\">bisa diukur</b> dan hasilnya <b class=\"hl\">dipakai orang lain</b>." },
        { tag: "LEVEL 1", text: "Di level pribadi, target saya punya angka. Waktu magang: menyelesaikan screening dalam 24 jam sejak lamaran masuk — sebelumnya rata-rata tiga hari." },
        { tag: "LEVEL 2", text: "Di level tim, ukurannya sederhana: apakah user berhenti menanyakan status kandidat. Setelah pipeline dirapikan, <b class=\"hl\">pertanyaan susulan turun drastis</b> karena mereka bisa melihat progresnya sendiri." },
        { tag: "LEVEL 3", text: "Tapi kecepatan saja berbahaya. Karena itu saya pasangkan dengan metrik kualitas: <b class=\"hl\">apakah kandidat yang saya loloskan bertahan dan perform di tiga bulan pertama</b>. Kalau cepat tapi salah orang, itu bukan sukses." },
      ],
    },
    pro: "Satu kalimat \"kalau cepat tapi salah, itu bukan sukses\" langsung memisahkan Anda dari kandidat yang hanya mengejar angka.",
    arena: "Skor project Arena dan peringkat mingguan adalah metrik siap pakai — sebut angkanya, bukan \"hasilnya bagus\".",
  },

  {
    id: "Q08",
    stage: 3,
    title: "Unique Value Proposition",
    question: "Apa yang membuat Anda berbeda dari kandidat lain?",
    tag: "PERSONAL BRANDING",
    target: "60 detik",
    level: 3,
    hidden: "Apa yang hilang dari tim ini kalau kami merekrut orang lain yang setara di atas kertas?",
    esensi:
      "Keunikan hampir tidak pernah datang dari satu skill tunggal, tapi dari irisan dua atau tiga hal yang jarang dimiliki bersamaan.",
    traps: [
      "\"Pekerja keras dan cepat belajar.\" Semua orang menulis itu.",
      "Membandingkan diri dengan merendahkan kandidat lain.",
      "Klaim besar tanpa satu pun bukti.",
    ],
    judged: [
      "Kesadaran diri yang tajam dan spesifik.",
      "Bukti, bukan kata sifat.",
      "Relevansi keunikan itu dengan kebutuhan posisi.",
    ],
    cheat: {
      name: "Unique Personal Branding Matrix",
      kind: "venn",
      nodes: [
        { key: "Skill A", label: "Keahlian inti", note: "Apa yang orang minta bantuan dari Anda?" },
        { key: "Skill B", label: "Keahlian pendukung", note: "Skill \"tidak nyambung\" apa yang Anda punya?" },
        { key: "Konteks", label: "Medan yang Anda kuasai", note: "Dunia apa yang Anda pahami luar-dalam?" },
      ],
      result: "Psikolog industri yang bisa menerjemahkan kebutuhan manusia menjadi sistem yang jalan.",
      note: "Titik irisan ketiganya adalah UVP Anda: \"sedikit orang yang punya ketiganya sekaligus\".",
    },
    answer: {
      file: "uvp.txt",
      lines: [
        { tag: "CLAIM", text: "Saya tidak akan bilang saya yang terbaik — saya tidak tahu siapa kandidat lainnya. Tapi ada satu kombinasi yang saya bawa dan tidak umum di lulusan psikologi." },
        { tag: "SKILL A", text: "Dasar saya kuat di <b class=\"hl\">asesmen dan interpretasi perilaku</b>, dan sudah saya pakai untuk menangani kandidat nyata, bukan studi kasus." },
        { tag: "SKILL B", text: "Saya juga terbiasa <b class=\"hl\">membangun sistem digital</b>: saya mengembangkan sendiri aplikasi pelacak kebiasaan, dari desain sampai basis datanya." },
        { tag: "IRISAN", text: "Efek praktisnya: waktu magang saya tidak hanya menjalankan rekrutmen, tapi juga merapikan cara datanya disimpan — pelaporan yang tadinya manual bisa ditarik dalam hitungan menit." },
        { tag: "FIT", text: "Jadi yang saya tawarkan bukan tenaga tambahan, tapi orang yang <b class=\"hl\">memperbaiki prosesnya sambil menjalankannya</b>." },
      ],
    },
    pro: "Buka dengan mengakui Anda tidak tahu kandidat lain. Itu membuat klaim setelahnya terdengar sebagai fakta, bukan sombong.",
    arena: "Portofolio project lintas divisi di Arena adalah bahan mentah terbaik untuk mencari irisan dua skill Anda.",
  },
];
