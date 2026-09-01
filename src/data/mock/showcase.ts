import type { SpotlightProject } from '@/types/showcase';

export const mockSpotlight: SpotlightProject[] = [
  {
    slug: 'sales-dashboard-alvin-w36',
    week: 36,
    weekLabel: 'Minggu 36 · 2 Sep',
    projectTitle: 'Sales Performance Dashboard',
    projectSlug: 'sales-performance-dashboard',
    participant: 'Alvin P.',
    role: 'Data Analyst',
    score: 88,
    skillsProven: ['Excel', 'Data Visualization', 'Business Insight'],
    reason:
      'Dipilih karena dashboard-nya jelas, hierarchy kuat, dan setiap insight langsung bisa ditindaklanjuti oleh founder.',
    challenge:
      'Brand fashion UMKM menyimpan data penjualan di 3 file Excel terpisah — offline store, marketplace, dan direct-to-consumer — sehingga founder tidak pernah melihat gambaran penjualan lengkap dalam satu view.',
    process: [
      'Menggabungkan 3 file channel ke satu tabel master dengan struktur kolom yang konsisten.',
      'Membersihkan duplikasi transaksi dan menyeragamkan format tanggal antar channel.',
      'Menentukan 4 KPI utama bersama konteks bisnis: total revenue, margin, channel terbaik, produk terlaris.',
      'Membangun dashboard dengan filter periode dan channel, lalu menguji dengan 3 pertanyaan bisnis founder.',
      'Menuliskan 3 insight actionable beserta rekomendasi tindak lanjutnya.',
    ],
    deliverables: [
      'Dashboard interaktif dengan filter periode & channel',
      'Ringkasan insight 1 halaman',
      'Rekomendasi aksi untuk channel terlemah',
    ],
    feedbackExcerpt:
      'Insight mudah dipahami dan langsung actionable. Dashboard hierarchy kuat — mata langsung ke KPI utama. Area pengembangan: tambahkan comparison period (WoW / MoM) untuk konteks tren.',
    isFeatured: true,
  },
  {
    slug: 'checkout-redesign-sari-w36',
    week: 36,
    weekLabel: 'Minggu 36 · 2 Sep',
    projectTitle: 'Redesign Checkout Flow Marketplace',
    projectSlug: 'redesign-checkout-flow',
    participant: 'Sari M.',
    role: 'UI/UX',
    score: 85,
    skillsProven: ['Figma', 'UX Flow', 'Wireframe'],
    reason: 'Problem framing tajam dan mockup hi-fi-nya rapi dengan rationale yang jelas per keputusan.',
    challenge:
      '68% pengguna meninggalkan checkout di step pengiriman karena form yang panjang dan tidak memandu.',
    process: [
      'Memetakan alur lama dan menandai titik friksi per langkah.',
      'Merancang alur baru 2-step dengan autofill alamat.',
      'Menguji wireframe dengan 5 pengguna marketplace.',
    ],
    deliverables: ['Flow sebelum vs sesudah', 'Hi-fi mockup 2 screen'],
    feedbackExcerpt:
      'Alur baru terasa lebih ringan tanpa menghilangkan rasa aman user. Kuat untuk level intermediate.',
  },
  {
    slug: 'landing-page-raka-w36',
    week: 36,
    weekLabel: 'Minggu 36 · 2 Sep',
    projectTitle: 'Landing Page untuk Coffee UMKM',
    projectSlug: 'landing-page-coffee-umkm',
    participant: 'Raka D.',
    role: 'Front-End',
    score: 84,
    skillsProven: ['HTML', 'CSS', 'Responsive'],
    reason: 'Halaman cepat, rapi di semua ukuran layar, dan karakter brand-nya terasa kuat.',
    challenge: 'Coffee shop tanpa kehadiran online — pelanggan tidak bisa melihat menu sebelum datang.',
    process: [
      'Menerjemahkan brand kit menjadi sistem warna dan tipografi.',
      'Membangun halaman mobile-first dengan animasi scroll ringan.',
      'Optimasi gambar menu agar loading tetap cepat.',
    ],
    deliverables: ['Landing page live', 'Source code + README'],
    feedbackExcerpt: 'Implementasi bersih dan konsisten. Tipografi dan spacing-nya matang.',
  },
  {
    slug: 'jd-data-engineer-nadia-w35',
    week: 35,
    weekLabel: 'Minggu 35 · 26 Agu',
    projectTitle: 'Job Description Data Engineer',
    projectSlug: 'job-description-data-engineer',
    participant: 'Nadia K.',
    role: 'Talent Acquisition',
    score: 82,
    skillsProven: ['Recruiting', 'Writing'],
    reason: 'JD-nya jujur, spesifik, dan scoring rubric-nya langsung dipakai tim untuk screening.',
    challenge: 'Startup fintech kesulitan mendapat kandidat Data Engineer karena JD-nya generik.',
    process: [
      'Intake dengan tim data untuk memetakan kebutuhan nyata.',
      'Memisahkan requirement wajib dari nilai-plus.',
      'Menyusun rubrik skoring 6 kriteria.',
    ],
    deliverables: ['JD final siap publish', 'Scoring rubric'],
    feedbackExcerpt: 'Salah satu JD terbaik minggu ini — jelas, jujur, dan bisa langsung dipakai.',
  },
  {
    slug: 'content-plan-bima-w35',
    week: 35,
    weekLabel: 'Minggu 35 · 26 Agu',
    projectTitle: 'Content Plan 4 Minggu',
    projectSlug: 'content-plan-4-minggu',
    participant: 'Bima R.',
    role: 'Content',
    score: 80,
    skillsProven: ['Content Strategy', 'Copywriting'],
    reason: 'Calendar-nya realistis untuk tim kecil dan pillar-nya berbasis data engagement.',
    challenge: 'Skincare lokal posting improvisasi — engagement turun 30% dalam 2 bulan.',
    process: [
      'Menganalisis data engagement 3 bulan terakhir.',
      'Menetapkan 4 pillar berdasarkan performa.',
      'Menyusun calendar 16 posting dengan format bervariasi.',
    ],
    deliverables: ['Editorial calendar 4 minggu', '3 contoh caption'],
    feedbackExcerpt: 'Strategi solid dan realistis. Caption-nya on-brand.',
  },
];

export const WEEK_HISTORY = [
  { week: 36, label: 'Minggu 36', winner: 'Sales Performance Dashboard', participant: 'Alvin P.', score: 88, slug: 'sales-dashboard-alvin-w36' },
  { week: 35, label: 'Minggu 35', winner: 'Job Description Data Engineer', participant: 'Nadia K.', score: 82, slug: 'jd-data-engineer-nadia-w35' },
  { week: 34, label: 'Minggu 34', winner: 'Pricing Experiment Brief', participant: 'Dita S.', score: 85, slug: null },
  { week: 33, label: 'Minggu 33', winner: 'Data Insight Presentation', participant: 'Fajar W.', score: 83, slug: null },
];

export function getSpotlight(slug: string): SpotlightProject | undefined {
  return mockSpotlight.find((s) => s.slug === slug);
}
