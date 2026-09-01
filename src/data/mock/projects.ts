import type { ArenaProject } from '@/types/project';

const RUBRIC_DATA = [
  { id: 'r1', label: 'Understanding', weight: 25, description: 'Seberapa tepat kamu memahami konteks bisnis dan objective.' },
  { id: 'r2', label: 'Execution', weight: 25, description: 'Kelengkapan dan kualitas teknis dari deliverables.' },
  { id: 'r3', label: 'Analysis & Insight', weight: 25, description: 'Kedalaman analisis dan ke-actionsable-an insight.' },
  { id: 'r4', label: 'Visualization', weight: 25, description: 'Kejelasan visual, hierarki, dan cara penyampaian.' },
];

const RUBRIC_BUILD = [
  { id: 'r1', label: 'Understanding', weight: 25, description: 'Pemahaman kebutuhan user dan konteks produk.' },
  { id: 'r2', label: 'Execution', weight: 25, description: 'Kualitas implementasi dan struktur kode.' },
  { id: 'r3', label: 'Attention to Detail', weight: 25, description: 'Konsistensi, edge case, dan finishing.' },
  { id: 'r4', label: 'Presentation', weight: 25, description: 'Cara kamu mempresentasikan hasil kerja.' },
];

const RUBRIC_DESIGN = [
  { id: 'r1', label: 'Problem Framing', weight: 25, description: 'Kejelasan definisi masalah dan tujuan redesign.' },
  { id: 'r2', label: 'Process', weight: 25, description: 'Alur berpikir dari riset hingga keputusan desain.' },
  { id: 'r3', label: 'Craft', weight: 25, description: 'Kualitas visual, konsistensi, dan hierarchy.' },
  { id: 'r4', label: 'Rationale', weight: 25, description: 'Justifikasi setiap keputusan desain.' },
];

const RUBRIC_COMMS = [
  { id: 'r1', label: 'Understanding', weight: 25, description: 'Pemahaman audience dan tujuan komunikasi.' },
  { id: 'r2', label: 'Strategy', weight: 25, description: 'Ketepatan pendekatan dan struktur pesan.' },
  { id: 'r3', label: 'Execution', weight: 25, description: 'Kualitas copy, visual, dan kelengkapan deliverables.' },
  { id: 'r4', label: 'Practicality', weight: 25, description: 'Seberapa siap output dipakai oleh tim nyata.' },
];

export const mockProjects: ArenaProject[] = [
  {
    slug: 'sales-performance-dashboard',
    category: 'Data Analyst',
    group: 'Data',
    week: 36,
    title: 'Sales Performance Dashboard untuk UMKM Fashion',
    shortDescription:
      'Bangun dashboard analitik penjualan untuk UMKM fashion. Fokus pada insight yang bisa langsung diaksikan.',
    caseBackground:
      'Sebuah brand fashion lokal skala UMKM baru saja menyelesaikan campaign lebaran dan ingin memahami performa penjualan lintas channel: offline store, marketplace (Tokopedia, Shopee), dan direct-to-consumer via WhatsApp. Data mereka masih tersebar di beberapa file Excel.',
    role: 'Kamu berperan sebagai Junior Data Analyst yang di-hire freelance untuk membangun satu dashboard yang bisa dipakai founder dalam weekly review.',
    mission: 'Menyatukan data penjualan tiga channel ke satu dashboard yang mudah dibaca founder — bukan sekadar chart, tapi insight yang bisa langsung ditindaklanjuti.',
    objective: [
      'Menyatukan data penjualan tiga channel ke satu view.',
      'Menyorot channel dengan performa tertinggi dan terendah.',
      'Memberikan minimal 3 insight yang bisa langsung ditindaklanjuti.',
    ],
    deliverables: [
      { id: 'd-1', title: 'Dashboard interaktif', description: 'Google Sheets / Looker Studio / Excel — dengan filter periode dan channel.' },
      { id: 'd-2', title: 'Ringkasan insight 1 halaman', description: '3+ insight utama dengan rekomendasi tindakan.' },
      { id: 'd-3', title: 'Link publik', description: 'Link yang bisa diakses reviewer tanpa permission tambahan.' },
    ],
    skills: ['Excel', 'Data Cleaning', 'Data Visualization', 'Business Insight'],
    resources: [
      { id: 'res-1', title: 'sales_channel_data.xlsx', kind: 'dataset' },
      { id: 'res-2', title: 'brand_context_brief.pdf', kind: 'document' },
      { id: 'res-3', title: 'Template dashboard starter', kind: 'template' },
    ],
    difficulty: 'Beginner',
    estimatedTime: '4–6 jam',
    deadlineLabel: 'Jumat · 21:59',
    points: 120,
    participants: 248,
    rubric: RUBRIC_DATA,
    isThisWeek: true,
  },
  {
    slug: 'sql-customer-segmentation',
    category: 'Data Analyst',
    group: 'Data',
    week: 37,
    title: 'SQL Customer Segmentation',
    shortDescription:
      'Segmentasikan 12.000 pelanggan e-commerce berdasarkan perilaku belanja menggunakan SQL, lalu ringkas jadi rekomendasi bisnis.',
    caseBackground:
      'Sebuah e-commerce lokal memiliki 12.000 pelanggan aktif tapi belum memahami segmen mana yang paling bernilai. Tim growth ingin segmentasi berbasis data (recency, frequency, monetary) untuk merancang campaign retensi.',
    role: 'Kamu berperan sebagai Junior Data Analyst yang menulis query segmentasi dan menerjemahkannya jadi rekomendasi campaign.',
    mission: 'Bangun segmentasi pelanggan berbasis RFM dengan SQL dan sajikan rekomendasi per segmen.',
    objective: [
      'Menulis query SQL untuk segmentasi RFM.',
      'Menjelaskan karakteristik tiap segmen utama.',
      'Memberikan rekomendasi campaign untuk 2 segmen prioritas.',
    ],
    deliverables: [
      { id: 'd-1', title: 'File SQL segmentasi', description: 'Query terstruktur dengan komentar per step.' },
      { id: 'd-2', title: 'Tabel ringkasan segmen', description: 'Jumlah pelanggan dan nilai belanja per segmen.' },
      { id: 'd-3', title: 'Rekomendasi campaign', description: 'Untuk 2 segmen prioritas, lengkap dengan alasannya.' },
    ],
    skills: ['SQL', 'Data Analysis', 'Business Insight'],
    resources: [
      { id: 'res-1', title: 'customers_sample.csv', kind: 'dataset' },
      { id: 'res-2', title: 'Panduan dasar RFM', kind: 'document' },
    ],
    difficulty: 'Intermediate',
    estimatedTime: '6–8 jam',
    deadlineLabel: 'Jumat · 21:59',
    points: 160,
    participants: 164,
    rubric: RUBRIC_DATA,
  },
  {
    slug: 'landing-page-coffee-umkm',
    category: 'Front-End',
    group: 'Development',
    week: 36,
    title: 'Landing Page untuk Coffee UMKM',
    shortDescription:
      'Buat landing page single-page dengan hero, menu, kontak, dan animasi scroll ringan.',
    caseBackground:
      'Sebuah coffee shop kecil di Bandung ingin punya kehadiran online yang sederhana: satu halaman yang menampilkan brand, menu andalan, lokasi, dan cara pesan. Mereka tidak butuh CMS — cukup satu halaman cepat dan mobile-friendly.',
    role: 'Kamu berperan sebagai Front-End Developer freelance yang membangun dan men-deploy halaman tersebut.',
    mission: 'Bangun satu landing page yang cepat, rapi di semua ukuran layar, dan mencerminkan karakter brand.',
    objective: [
      'Menerjemahkan konten brand jadi struktur halaman yang jelas.',
      'Membangun hero, menu, lokasi, dan kontak dengan HTML/CSS.',
      'Memastikan tampilan rapi di mobile, tablet, dan desktop.',
    ],
    deliverables: [
      { id: 'd-1', title: 'Landing page live', description: 'Di-hosting gratis (Vercel / Netlify / GitHub Pages).' },
      { id: 'd-2', title: 'Source code', description: 'Repository publik dengan README singkat.' },
      { id: 'd-3', title: 'Catatan implementasi', description: '3–5 poin keputusan teknis yang kamu ambil.' },
    ],
    skills: ['HTML', 'CSS', 'Responsive'],
    resources: [
      { id: 'res-1', title: 'brand_kit_coffee.zip', kind: 'document' },
      { id: 'res-2', title: 'Konten menu & foto', kind: 'document' },
      { id: 'res-3', title: 'Referensi tipografi', kind: 'link' },
    ],
    difficulty: 'Beginner',
    estimatedTime: '6–8 jam',
    deadlineLabel: 'Jumat · 21:59',
    points: 140,
    participants: 201,
    rubric: RUBRIC_BUILD,
    isThisWeek: true,
  },
  {
    slug: 'portfolio-website-developer',
    category: 'Web Developer',
    group: 'Development',
    week: 37,
    title: 'Portfolio Website untuk Developer',
    shortDescription:
      'Bangun portfolio pribadi dengan 3 halaman: about, projects, dan contact — dengan fokus performa dan aksesibilitas.',
    caseBackground:
      'Kamu ingin melamar kerja sebagai web developer, tapi CV saja tidak cukup. Kamu butuh satu tempat yang menampilkan project, skill, dan cara kerjamu — cepat diakses dari HP recruiter.',
    role: 'Kamu berperan sebagai Web Developer yang mendesain dan membangun situs portfoliomu sendiri.',
    mission: 'Bangun portfolio yang membuat recruiter paham kemampuanmu dalam 30 detik.',
    objective: [
      'Menyusun konten portfolio yang fokus pada bukti, bukan klaim.',
      'Membangun 3 halaman dengan navigasi yang konsisten.',
      'Mencapai skor performa yang sehat di mobile.',
    ],
    deliverables: [
      { id: 'd-1', title: 'Portfolio live', description: '3 halaman: about, projects, contact.' },
      { id: 'd-2', title: 'Source code', description: 'Repository publik.' },
      { id: 'd-3', title: 'Checklist performa', description: 'Skor Lighthouse dan apa yang kamu perbaiki.' },
    ],
    skills: ['HTML', 'CSS', 'JavaScript', 'Performance'],
    resources: [
      { id: 'res-1', title: 'Contoh portfolio referensi', kind: 'link' },
      { id: 'res-2', title: 'Checklist aksesibilitas dasar', kind: 'document' },
    ],
    difficulty: 'Intermediate',
    estimatedTime: '8–10 jam',
    deadlineLabel: 'Jumat · 21:59',
    points: 180,
    participants: 96,
    rubric: RUBRIC_BUILD,
  },
  {
    slug: 'redesign-checkout-flow',
    category: 'UI/UX',
    group: 'Design',
    week: 36,
    title: 'Redesign Checkout Flow Marketplace',
    shortDescription:
      'Perbaiki alur checkout 3-step. Sertakan flow, wireframe, dan hi-fi mockup 2 screen.',
    caseBackground:
      'Sebuah marketplace lokal mencatat 68% pengguna meninggalkan checkout di step pengiriman. Tim produk menduga alurnya terlalu panjang dan form-nya tidak memandu user. Mereka minta proposal redesign yang terukur.',
    role: 'Kamu berperan sebagai Product Designer yang memetakan masalah dan mengusulkan alur baru.',
    mission: 'Redesign alur checkout menjadi lebih pendek dan jelas tanpa mengorbankan kepercayaan user.',
    objective: [
      'Mengidentifikasi 2–3 penyebab utama drop-off.',
      'Mengusulkan alur baru dengan flow yang jelas.',
      'Menyajikan mockup hi-fi untuk 2 layar kunci.',
    ],
    deliverables: [
      { id: 'd-1', title: 'Flow sebelum vs sesudah', description: 'Annotasi singkat di tiap langkah.' },
      { id: 'd-2', title: 'Wireframe alur baru', description: 'Low-fi, 3–4 layar.' },
      { id: 'd-3', title: 'Hi-fi mockup 2 screen', description: 'Form pengiriman dan ringkasan pesanan.' },
    ],
    skills: ['Figma', 'UX Flow', 'Wireframe'],
    resources: [
      { id: 'res-1', title: 'Screenshot alur saat ini', kind: 'document' },
      { id: 'res-2', title: 'Data drop-off per step', kind: 'dataset' },
      { id: 'res-3', title: 'UI kit marketplace', kind: 'template' },
    ],
    difficulty: 'Intermediate',
    estimatedTime: '6–10 jam',
    deadlineLabel: 'Jumat · 21:59',
    points: 160,
    participants: 132,
    rubric: RUBRIC_DESIGN,
    isThisWeek: true,
  },
  {
    slug: 'content-plan-4-minggu',
    category: 'Content',
    group: 'Marketing',
    week: 36,
    title: 'Content Plan 4 Minggu',
    shortDescription:
      'Susun editorial calendar 4 minggu untuk brand skincare lokal. Tentukan pillar dan format.',
    caseBackground:
      'Brand skincare lokal dengan 8K followers ingin konsisten posting 4x per minggu. Selama ini kontennya improvasi — kadang edukasi, kadang promo — dan engagement-nya turun. Mereka butuh struktur 4 minggu yang jelas.',
    role: 'Kamu berperan sebagai Junior Content Strategist yang menyusun calendar dan arahan konten.',
    mission: 'Rancang editorial calendar 4 minggu dengan pillar yang jelas dan format yang realistis untuk tim kecil.',
    objective: [
      'Menentukan 3–4 content pillar beserta alasannya.',
      'Menyusun calendar 4 minggu (16 posting).',
      'Mendefinisikan format dan tone per pillar.',
    ],
    deliverables: [
      { id: 'd-1', title: 'Content pillar', description: 'Dengan rationale per pillar.' },
      { id: 'd-2', title: 'Editorial calendar', description: '4 minggu, siap dipakai tim.' },
      { id: 'd-3', title: 'Contoh caption', description: '3 caption yang mewakili tiap pillar.' },
    ],
    skills: ['Content Strategy', 'Copywriting'],
    resources: [
      { id: 'res-1', title: 'Brand voice skincare', kind: 'document' },
      { id: 'res-2', title: 'Data engagement 3 bulan', kind: 'dataset' },
    ],
    difficulty: 'Beginner',
    estimatedTime: '4–5 jam',
    deadlineLabel: 'Jumat · 21:59',
    points: 100,
    participants: 187,
    rubric: RUBRIC_COMMS,
    isThisWeek: true,
  },
  {
    slug: 'campaign-brief-launch',
    category: 'Marketing',
    group: 'Marketing',
    week: 37,
    title: 'Campaign Brief · Launch Produk',
    shortDescription:
      'Susun campaign brief untuk peluncuran produk baru, lengkap dengan KPI dan channel mix.',
    caseBackground:
      'Sebuah brand minuman akan meluncurkan varian baru di 3 kota. Tim marketing butuh satu brief yang menyatukan target, pesan, channel, dan cara ukur keberhasilannya — sebelum eksekusi dimulai.',
    role: 'Kamu berperan sebagai Junior Marketing Strategist yang menyusun brief yang bisa langsung dieksekusi tim.',
    mission: 'Menyusun campaign brief satu dokumen yang membuat eksekutor paham apa, kenapa, dan bagaimana.',
    objective: [
      'Merumuskan insight dan big idea campaign.',
      'Menentukan channel mix dan peran tiap channel.',
      'Mendefinisikan KPI utama dan targetnya.',
    ],
    deliverables: [
      { id: 'd-1', title: 'Campaign brief', description: 'Maksimal 2 halaman.' },
      { id: 'd-2', title: 'Channel plan', description: 'Channel, format, dan perannya.' },
      { id: 'd-3', title: 'KPI plan', description: 'Metrik, baseline, target.' },
    ],
    skills: ['Strategy', 'Brief', 'KPI'],
    resources: [
      { id: 'res-1', title: 'Product one-pager', kind: 'document' },
      { id: 'res-2', title: 'Data market minuman', kind: 'dataset' },
    ],
    difficulty: 'Intermediate',
    estimatedTime: '5–7 jam',
    deadlineLabel: 'Jumat · 21:59',
    points: 130,
    participants: 118,
    rubric: RUBRIC_COMMS,
  },
  {
    slug: 'job-description-data-engineer',
    category: 'Talent Acquisition',
    group: 'HR',
    week: 36,
    title: 'Job Description Data Engineer',
    shortDescription:
      'Tulis JD lengkap dengan role, responsibility, requirement, dan skoring criteria kandidat.',
    caseBackground:
      'Sebuah startup fintech membuka posisi Data Engineer pertama mereka. Tim HR belum paham peran ini secara teknis, dan JD yang ada sekarang menyalin template asing yang tidak relevan dengan konteks lokal.',
    role: 'Kamu berperan sebagai TA Specialist yang menerjemahkan kebutuhan tim data menjadi JD yang jujur dan menarik.',
    mission: 'Menulis JD yang akurat secara teknis dan menarik untuk kandidat yang tepat.',
    objective: [
      'Menerjemahkan kebutuhan tim menjadi responsibilities yang jelas.',
      'Memisahkan requirement wajib dan nilai-plus.',
      'Membuat scoring criteria untuk menyaring kandidat.',
    ],
    deliverables: [
      { id: 'd-1', title: 'Job description final', description: 'Siap publish.' },
      { id: 'd-2', title: 'Scoring rubric', description: 'Kriteria penilaian CV tahap pertama.' },
      { id: 'd-3', title: 'Catatan sourcing', description: '2–3 channel untuk mencari kandidat.' },
    ],
    skills: ['Recruiting', 'Writing'],
    resources: [
      { id: 'res-1', title: 'Intake notes dari tim data', kind: 'document' },
      { id: 'res-2', title: 'Contoh JD benchmark', kind: 'document' },
    ],
    difficulty: 'Beginner',
    estimatedTime: '3–4 jam',
    deadlineLabel: 'Jumat · 21:59',
    points: 90,
    participants: 76,
    rubric: RUBRIC_COMMS,
    isThisWeek: true,
  },
  {
    slug: 'onboarding-program-30-hari',
    category: 'L&D',
    group: 'HR',
    week: 37,
    title: 'Onboarding Program 30 Hari',
    shortDescription:
      'Rancang program onboarding 30 hari untuk karyawan baru remote, lengkap dengan milestone dan materi.',
    caseBackground:
      'Sebuah agency remote dengan 25 orang memiliki turnover tinggi di 3 bulan pertama. Exit interview menunjukkan karyawan baru merasa "dilepas sendiri" setelah hari pertama. HR ingin program 30 hari yang terstruktur.',
    role: 'Kamu berperan sebagai L&D Associate yang merancang pengalaman 30 hari pertama karyawan baru.',
    mission: 'Rancang program yang membuat karyawan baru produktif dan merasa diterima dalam 30 hari.',
    objective: [
      'Memetakan milestone per minggu (minggu 1–4).',
      'Merancang buddy system dan check-in cadence.',
      'Menyusun daftar materi dan tugas praktik.',
    ],
    deliverables: [
      { id: 'd-1', title: 'Program 30 hari', description: 'Timeline mingguan dengan milestone.' },
      { id: 'd-2', title: 'Buddy & check-in plan', description: 'Siapa bertemu siapa, kapan.' },
      { id: 'd-3', title: 'Materi inti', description: 'Daftar + outline 3 materi utama.' },
    ],
    skills: ['Instructional Design', 'Program Design', 'Communication'],
    resources: [
      { id: 'res-1', title: 'Hasil exit interview', kind: 'dataset' },
      { id: 'res-2', title: 'Struktur tim agency', kind: 'document' },
    ],
    difficulty: 'Intermediate',
    estimatedTime: '5–7 jam',
    deadlineLabel: 'Jumat · 21:59',
    points: 150,
    participants: 64,
    rubric: RUBRIC_COMMS,
  },
  {
    slug: 'sop-administrasi-arsip',
    category: 'Administration',
    group: 'Business',
    week: 37,
    title: 'SOP Administrasi & Arsip Dokumen',
    shortDescription:
      'Buat SOP penyimpanan dan penamaan dokumen untuk bisnis kecil yang dokumennya tumpang tindih di 3 tempat.',
    caseBackground:
      'Sebuah bisnis distributor menyimpan dokumen operasional di Google Drive, WhatsApp, dan lemari fisik. Saat butuh invoice 6 bulan lalu, staf butuh satu jam untuk mencarinya. Pemilik bisnis ingin satu SOP sederhana yang bisa dijalankan.',
    role: 'Kamu berperan sebagai Administration Officer yang merapikan sistem dokumen tanpa menghentikan operasional.',
    mission: 'Menyusun SOP yang membuat dokumen mudah ditemukan dalam 30 detik oleh siapa pun.',
    objective: [
      'Menyusun struktur folder dan konvensi penamaan.',
      'Mendefinisikan alur simpan untuk 3 jenis dokumen utama.',
      'Membuat checklist maintenance mingguan.',
    ],
    deliverables: [
      { id: 'd-1', title: 'SOP dokumen', description: 'Maksimal 2 halaman, bahasa sederhana.' },
      { id: 'd-2', title: 'Struktur folder template', description: 'Siap dipindah ke Drive.' },
      { id: 'd-3', title: 'Checklist mingguan', description: 'Untuk menjaga sistem tetap rapi.' },
    ],
    skills: ['Process Design', 'Documentation', 'Attention to Detail'],
    resources: [
      { id: 'res-1', title: 'Inventaris dokumen saat ini', kind: 'document' },
      { id: 'res-2', title: 'Template SOP referensi', kind: 'template' },
    ],
    difficulty: 'Beginner',
    estimatedTime: '3–4 jam',
    deadlineLabel: 'Jumat · 21:59',
    points: 80,
    participants: 58,
    rubric: RUBRIC_COMMS,
  },
  {
    slug: 'partnership-outreach-kit',
    category: 'Partnership',
    group: 'Business',
    week: 36,
    title: 'Partnership Outreach Kit',
    shortDescription:
      'Susun outreach kit untuk mengajukan kolaborasi ke 10 brand potensial: deck satu halaman, email, dan follow-up plan.',
    caseBackground:
      'Sebuah komunitas freelance dengan 1.200 anggota ingin menjalin partnership dengan brand untuk program workshop. Mereka pernah mengirim email tapi tingkat balasannya rendah karena pendekatannya kurang terstruktur.',
    role: 'Kamu berperan sebagai Partnership Associate yang menyusun materi pendekatan yang profesional dan personal.',
    mission: 'Membuat kit yang membuat brand potensial melihat nilai kolaborasi dalam 2 menit.',
    objective: [
      'Merumuskan nilai yang ditawarkan ke brand (bukan sebaliknya).',
      'Menyusun one-pager partnership.',
      'Menulis email outreach dan cadence follow-up.',
    ],
    deliverables: [
      { id: 'd-1', title: 'One-pager partnership', description: 'Nilai, audiens, format kolaborasi.' },
      { id: 'd-2', title: 'Email outreach', description: 'Template personal + 2 varian subject.' },
      { id: 'd-3', title: 'Follow-up plan', description: 'Cadence dan titik stop.' },
    ],
    skills: ['Partnership', 'Business Writing', 'Negotiation Prep'],
    resources: [
      { id: 'res-1', title: 'Profil komunitas & audiens', kind: 'document' },
      { id: 'res-2', title: 'Daftar 10 brand target', kind: 'dataset' },
    ],
    difficulty: 'Intermediate',
    estimatedTime: '4–6 jam',
    deadlineLabel: 'Jumat · 21:59',
    points: 120,
    participants: 49,
    rubric: RUBRIC_COMMS,
    isThisWeek: true,
  },
  {
    slug: 'excel-sales-forecast',
    category: 'Data Analyst',
    group: 'Data',
    week: 38,
    title: 'Excel Sales Forecast Sederhana',
    shortDescription:
      'Bangun model forecast penjualan 3 bulan di Excel dengan asumsi yang terdokumentasi dan skenario best/worst case.',
    caseBackground:
      'Sebuah bisnis retail kecil ingin tahu perkiraan penjualan kuartal depan untuk menyiapkan stok. Mereka hanya nyaman dengan Excel — bukan tool kompleks. Modelnya harus bisa dipahami dan diubah pemilik bisnis sendiri.',
    role: 'Kamu berperan sebagai Junior Data Analyst yang membangun model forecast yang transparan.',
    mission: 'Membuat model Excel yang jujur soal asumsi dan berguna untuk keputusan stok.',
    objective: [
      'Membangun baseline trend dari data 12 bulan.',
      'Mendokumentasikan semua asumsi model.',
      'Menyediakan skenario best, normal, worst case.',
    ],
    deliverables: [
      { id: 'd-1', title: 'File Excel model', description: 'Dengan sheet asumsi terpisah.' },
      { id: 'd-2', title: 'Ringkasan asumsi', description: 'Kenapa angka itu dipakai.' },
      { id: 'd-3', title: 'Rekomendasi stok', description: 'Berdasarkan skenario normal.' },
    ],
    skills: ['Excel', 'Forecasting', 'Business Insight'],
    resources: [
      { id: 'res-1', title: 'penjualan_12_bulan.csv', kind: 'dataset' },
      { id: 'res-2', title: 'Catatan musiman bisnis', kind: 'document' },
    ],
    difficulty: 'Beginner',
    estimatedTime: '4–6 jam',
    deadlineLabel: 'Jumat · 21:59',
    points: 110,
    participants: 141,
    rubric: RUBRIC_DATA,
  },
];

export const RECOMMENDED_PROJECT_SLUG = 'sales-performance-dashboard';
export const NEXT_PROJECT_SLUG = 'sql-customer-segmentation';

export function getProject(slug: string): ArenaProject | undefined {
  return mockProjects.find((p) => p.slug === slug);
}

export const THIS_WEEK_PROJECTS = mockProjects.filter((p) => p.isThisWeek);

export const PROJECT_GROUP_LABELS: Record<string, string> = {
  Data: 'Data',
  Development: 'Development',
  Design: 'Design',
  Marketing: 'Marketing',
  HR: 'HR',
  Business: 'Business',
};
