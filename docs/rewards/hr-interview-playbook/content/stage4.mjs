/**
 * Stage 4 — Pressure & Decision. Q09–Q11, plus the master template Q12.
 *
 * Q12 is not a question but the format kit the whole stage leans on, so it is
 * rendered by its own template (`kind: "master"`) instead of the blueprint one.
 */

export const stage4 = [
  {
    id: "Q09",
    stage: 4,
    title: "Handling Challenge",
    question: "Bagaimana Anda mengatasi situasi yang menantang?",
    tag: "CBL + CAR",
    target: "100 detik",
    level: 3,
    hidden: "Saat tidak ada SOP dan tidak ada yang menolong, Anda bergerak atau menunggu?",
    esensi:
      "Yang dinilai bukan sehebat apa hasilnya, tapi apakah Anda punya metode. Sebagian besar masalah di dunia kerja datang tanpa petunjuk.",
    traps: [
      "Memilih tantangan remeh: deadline tugas kuliah biasa.",
      "Panjang di bagian masalah, pendek di bagian tindakan.",
      "Hasil akhir tanpa angka atau bukti perubahan.",
    ],
    judged: [
      "Inisiatif dan kepemilikan masalah.",
      "Kemampuan memecah masalah besar jadi langkah kecil.",
      "Ketahanan saat percobaan pertama gagal.",
    ],
    cheat: {
      name: "Challenge-Based Learning Cycle",
      kind: "flow",
      nodes: [
        { key: "01", label: "Engage", note: "Akui masalahnya, rumuskan jadi pertanyaan yang bisa dijawab." },
        { key: "02", label: "Investigate", note: "Kumpulkan data, tanya yang lebih tahu, cari akar masalah." },
        { key: "03", label: "Act", note: "Uji solusi kecil, ukur, perbesar kalau berhasil." },
      ],
      note: "Sampaikan dengan format CAR. Porsi bicara yang benar: 20% challenge, 60% action, 20% result. Kebanyakan kandidat melakukan kebalikannya.",
      bars: [
        { key: "Challenge", pct: 20, note: "cukup untuk paham konteks" },
        { key: "Action", pct: 60, note: "di sinilah Anda dinilai" },
        { key: "Result", pct: 20, note: "wajib ada angka" },
      ],
    },
    answer: {
      file: "handling_challenge.txt (CAR)",
      lines: [
        { tag: "CHALLENGE", text: "Minggu keempat magang, saya diminta mengisi <b class=\"hl\">6 posisi operator dalam 3 minggu</b> — sementara pelamar yang masuk hanya sepertiga dari kebutuhan." },
        { tag: "ENGAGE", text: "Saya rumuskan ulang masalahnya: bukan \"kurang pelamar\", tapi <b class=\"hl\">\"iklan kami tidak sampai ke orang yang tepat\"</b>." },
        { tag: "INVESTIGATE", text: "Saya cek data dua bulan terakhir: mayoritas pelamar yang lolos datang dari <b class=\"hl\">satu kanal saja</b>, sementara anggaran tersebar rata ke empat kanal." },
        { tag: "ACT", text: "Saya usulkan uji coba seminggu: fokuskan ke kanal itu, ubah judul lowongan memakai istilah yang benar-benar dipakai pelamar, dan aktifkan jalur referral karyawan." },
        { tag: "RESULT", text: "Pelamar naik <b class=\"hl\">lebih dari dua kali lipat dalam 10 hari</b>, enam posisi terisi tepat sebelum tenggat, dan pendekatan referral itu dipakai lagi untuk batch berikutnya." },
      ],
    },
    pro: "Ceritakan juga percobaan yang gagal duluan, kalau ada. Metode terlihat nyata justru saat ada koreksi di tengah.",
    arena: "Brief Arena yang datanya berantakan atau waktunya mepet adalah stok cerita CAR yang sah.",
  },

  {
    id: "Q10",
    stage: 4,
    title: "Work Motivation",
    question: "Bagaimana cara Anda memotivasi diri sendiri?",
    tag: "STRESS × PERFORMANCE",
    target: "75 detik",
    level: 2,
    hidden: "Saat pekerjaan membosankan dan tidak ada yang memuji, Anda masih jalan atau berhenti?",
    esensi:
      "Perusahaan tidak bisa memotivasi Anda setiap hari. Yang dinilai: motivasi Anda datang dari sistem sendiri, atau menumpang pengakuan orang lain.",
    traps: [
      "\"Termotivasi oleh gaji dan bonus.\" Jujur, tapi rapuh.",
      "\"Saya selalu semangat, tidak pernah down.\" Tidak kredibel.",
      "Motivasi yang bergantung penuh pada pujian atasan.",
    ],
    judged: [
      "Sistem, bukan sekadar semangat.",
      "Kesadaran akan tanda-tanda kelelahan sendiri.",
      "Cara memulihkan diri tanpa mengorbankan hasil kerja.",
    ],
    cheat: {
      name: "Kurva Yerkes–Dodson",
      kind: "curve",
      nodes: [
        { key: "Input", label: "Sumber energi", note: "Alasan personal yang tidak bergantung orang lain, dan kemajuan yang terlihat." },
        { key: "Proses", label: "Sistem harian", note: "Pecah target besar jadi mingguan. Tugas terberat di jam energi tertinggi." },
        { key: "Recovery", label: "Rem darurat", note: "Kenali tanda awal lelah: menunda, mudah tersinggung. Pulih tanpa merusak." },
      ],
      note: "Performa memuncak pada tekanan sedang, lalu jatuh saat tekanan berlebih. Tugas Anda bukan menghilangkan tekanan, tapi menjaga posisi di puncak kurva.",
    },
    answer: {
      file: "work_motivation.txt",
      lines: [
        { tag: "JUJUR", text: "Saya tidak selalu semangat — dan saya rasa tidak ada yang begitu. Yang saya andalkan bukan mood, tapi <b class=\"hl\">sistem</b>." },
        { tag: "INPUT", text: "Sumber energi utama saya <b class=\"hl\">melihat kemajuan</b>. Karena itu target besar saya pecah jadi potongan mingguan yang bisa dicentang. Di masa skripsi, target saya bukan \"selesaikan bab 2\", tapi \"baca dan rangkum tiga jurnal hari ini\"." },
        { tag: "PROSES", text: "Pekerjaan yang butuh konsentrasi saya taruh di <b class=\"hl\">pagi hari</b>, saat fokus saya paling baik. Tugas administratif saya kumpulkan sore." },
        { tag: "RECOVERY", text: "Kalau saya mulai menunda-nunda, itu tanda lelah, bukan malas. Responnya bukan memaksa lembur, tapi mengatur ulang urutan tugas dan memastikan tidur cukup — <b class=\"hl\">kerja 12 jam dalam kondisi lelah hasilnya lebih buruk daripada 6 jam dalam kondisi segar</b>." },
      ],
    },
    pro: "Mengakui \"saya tidak selalu semangat\" di kalimat pertama justru menaikkan kredibilitas seluruh jawaban.",
    arena: "Ritme mingguan Arena — brief Senin, submit sebelum deadline — adalah contoh sistem yang bisa Anda ceritakan apa adanya.",
  },

  {
    id: "Q11",
    stage: 4,
    title: "Decision Making",
    question: "Ceritakan pengambilan keputusan yang menurut Anda berhasil.",
    tag: "VROOM–YETTON",
    target: "100 detik",
    level: 3,
    hidden: "Anda tahu kapan harus memutuskan sendiri, dan kapan harus melibatkan orang lain?",
    esensi:
      "Yang dinilai bukan keputusannya, tapi dasar Anda memilih cara memutuskan. Selalu memutuskan sendiri menabrak tim; selalu minta persetujuan semua orang melumpuhkan pekerjaan.",
    traps: [
      "Keputusan tanpa pertimbangan alternatif. Terdengar impulsif.",
      "\"Saya tanya senior, lalu ikut saja.\" Tidak ada Anda di dalamnya.",
      "Tidak menyebutkan risiko yang Anda terima.",
    ],
    judged: [
      "Kualitas informasi yang Anda kumpulkan sebelum memutuskan.",
      "Kesadaran siapa yang harus dilibatkan.",
      "Kesediaan menanggung konsekuensi.",
    ],
    cheat: {
      name: "Vroom–Yetton Decision Model",
      kind: "decision",
      note: "Disederhanakan dari lima gaya asli menjadi tiga yang paling sering dipakai di pekerjaan harian.",
      rows: [
        {
          style: "Autocratic",
          sub: "putuskan sendiri",
          when: "Informasi sudah lengkap di tangan Anda dan waktunya mendesak.",
          example: "Kandidat batal hadir 30 menit sebelum interview — Anda langsung atur jadwal ulang.",
        },
        {
          style: "Consultative",
          sub: "tanya dulu, putuskan sendiri",
          when: "Anda butuh masukan teknis, tapi tanggung jawab tetap di Anda.",
          example: "Minta pendapat user soal kriteria, keputusan akhir shortlist tetap Anda susun.",
        },
        {
          style: "Collaborative",
          sub: "putuskan bersama",
          when: "Keputusan butuh komitmen semua pihak supaya bisa jalan.",
          example: "Mengubah alur rekrutmen yang dipakai lintas divisi.",
        },
      ],
      checks: [
        ["Kualitas keputusan ini kritis?", "ya › jangan autokratik kalau data Anda kurang"],
        ["Informasi saya cukup?", "tidak › naik ke consultative"],
        ["Eksekusinya butuh dukungan orang lain?", "ya › naik ke collaborative"],
        ["Waktunya mendesak?", "ya › turun satu tingkat, tapi jelaskan alasannya"],
      ],
    },
    answer: {
      file: "decision_making.txt (STAR)",
      lines: [
        { tag: "S", text: "Saat magang, ada dua kandidat kuat untuk satu posisi: satu unggul teknis, satu unggul kecocokan tim. User meminta rekomendasi dalam dua hari." },
        { tag: "T", text: "Tugas saya menyusun rekomendasi yang bisa dipertanggungjawabkan, bukan menyerahkan dua nama." },
        { tag: "A", text: "Karena keputusannya kritis tapi informasi saya belum lengkap, saya pilih gaya <b class=\"hl\">consultative</b>: kumpulkan catatan interview dan hasil asesmen, lalu tanya user <b class=\"hl\">apa masalah terbesar tim saat ini</b>. Jawabannya menentukan — timnya kekurangan orang yang bisa bekerja mandiri. Rekomendasi saya susun sendiri, lengkap dengan risiko tiap pilihan." },
        { tag: "R", text: "Kandidat yang saya rekomendasikan diterima dan <b class=\"hl\">lolos masa percobaan tanpa catatan</b>. Pelajarannya: keputusan yang baik bukan soal memilih yang terbaik, tapi memilih yang paling tepat untuk masalah yang sedang dihadapi." },
      ],
    },
    pro: "Sebut satu risiko yang Anda terima sadar-sadar. Tanpa itu, cerita keputusan terdengar seperti keberuntungan.",
    arena: "Memilih project Arena mana yang diambil minggu ini — dan alasannya — sudah cukup jadi cerita keputusan.",
  },

  {
    id: "Q12",
    stage: 4,
    kind: "master",
    title: "STAR / CAR / PAR",
    question: "Satu cerita, tiga format. Kuasai ini dan Anda bisa menjawab pertanyaan behavioral apa pun.",
    tag: "MASTER TEMPLATE",
    hidden: "Ketiganya bersaudara. Bedanya hanya seberapa banyak konteks yang dibutuhkan sebelum masuk ke tindakan.",
    formats: [
      {
        name: "STAR",
        struct: "Situation › Task › Action › Result",
        best: "Cerita yang butuh konteks dan peran jelas: kepemimpinan, proyek panjang, keputusan.",
      },
      {
        name: "CAR",
        struct: "Challenge › Action › Result",
        best: "Hambatan, kegagalan, tekanan, situasi menantang.",
      },
      {
        name: "PAR",
        struct: "Problem › Action › Result",
        best: "Konflik, perbaikan proses, keluhan pelanggan — masalah yang langsung jelas.",
      },
    ],
    anatomy: [
      { part: "Situation", spec: "Kapan, di mana, kondisinya apa", len: "2 kalimat" },
      { part: "Task", spec: "Apa yang jadi tanggung jawab Anda", len: "1 kalimat" },
      { part: "Action", spec: "Langkah 1, 2, 3 — pakai kata kerja", len: "4–6 kalimat" },
      { part: "Result", spec: "Angka, lalu pembelajaran", len: "2 kalimat" },
    ],
    verbs: {
      strong: "saya usulkan, saya susun, saya negosiasikan, saya uji, saya redistribusi, saya verifikasi",
      weak: "saya membantu, saya ikut, saya terlibat",
    },
    quality: {
      bad: ["Tidak ada angka sama sekali.", "Tidak jelas mana bagian Anda, mana bagian tim.", "Berhenti di \"akhirnya berhasil\" tanpa bukti."],
      good: ["Ada satu angka atau perbandingan sebelum–sesudah.", "Ada satu keputusan sulit yang Anda ambil.", "Ditutup dengan pembelajaran, bukan pujian pada diri sendiri."],
    },
    templates: [
      {
        file: "template_id.txt — bahasa indonesia",
        lines: [
          { tag: "S", text: "\"Saat [waktu/konteks], tim kami menghadapi [kondisi] dengan [kendala spesifik].\"" },
          { tag: "T", text: "\"Tanggung jawab saya waktu itu adalah [target yang terukur].\"" },
          { tag: "A", text: "\"Langkah pertama, saya [tindakan + alasannya]. Setelah itu saya [tindakan kedua]. Ketika [hambatan muncul], saya memutuskan untuk [penyesuaian].\"" },
          { tag: "R", text: "\"Hasilnya, [angka/perubahan konkret]. Yang saya pelajari, [prinsip yang masih saya pakai].\"" },
        ],
      },
      {
        file: "template_en.txt — english",
        lines: [
          { tag: "S", text: "\"During my internship at [company], our team faced [situation] with [specific constraint].\"" },
          { tag: "T", text: "\"I was responsible for [measurable objective] within [timeframe].\"" },
          { tag: "A", text: "\"I started by [action + reasoning]. Then I [second action]. When [obstacle] came up, I decided to [adjustment].\"" },
          { tag: "R", text: "\"As a result, [quantified outcome]. The key takeaway for me was [principle I still apply].\"" },
        ],
      },
    ],
  },
];

