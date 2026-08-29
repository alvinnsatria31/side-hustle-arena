import type { WeeklyProject } from '@/types/project';

const marketingEvaluation = {
  score: 84,
  statusLabel: 'STRONG WORK',
  statusTone: 'strong' as const,
  rubric: [
    { label: 'Strategy', score: 87, description: 'Channel strategy selaras dengan target audience.' },
    { label: 'Problem Understanding', score: 82, description: 'Brief dipahami dengan baik, ada asumsi yang jelas.' },
    { label: 'Execution', score: 86, description: 'Campaign concept dan contoh eksekusi solid.' },
    { label: 'Communication', score: 80, description: 'Copywriting jelas, bisa lebih ringkas di beberapa bagian.' },
    { label: 'Practicality', score: 85, description: 'KPI realistis dengan timeline yang masuk akal.' },
  ],
  strengths: [
    'Strategi channel konsisten dengan target audience yang dipilih.',
    'Pesan campaign mudah dipahami dan punya diferensiasi jelas.',
    'KPI plan sudah memuat baseline, target, dan cara ukur.',
  ],
  improvements: [
    'KPI masih terlalu umum di beberapa channel. Tambahkan target numerik dan timeframe.',
    'Tambahkan contoh creative direction atau moodboard untuk eksekusi visual.',
  ],
  evaluatorNote:
    'Secara keseluruhan ini submission yang kuat untuk level junior. Strateginya matang dan pesan campaign-nya punya sudut pandang yang jelas. Area utama untuk berkembang ada di eksekusi visual dan granularitas metrik — keduanya akan datang dengan latihan dan eksposur ke campaign nyata.',
  submittedAt: '2025-08-22T21:42:00',
  evaluatedAt: '2025-08-23T12:00:00',
};

export const mockWeeklyProjects: WeeklyProject[] = [
  {
    slug: 'social-media-launch-strategy',
    division: 'Marketing',
    title: 'Build a Campaign Strategy',
    case:
      'Sebuah career platform ingin meningkatkan registrations untuk program internship-nya di kalangan mahasiswa semester 5–7.',
    role:
      'Kamu berperan sebagai Junior Marketing Strategist yang bertanggung jawab merancang strategi campaign dari riset hingga channel plan.',
    objective:
      'Menghasilkan strategi campaign yang bisa dijalankan dalam 3 minggu untuk meningkatkan sign-ups program internship minimal 30%.',
    difficulty: 'Intermediate',
    effort: '4–6 jam',
    skills: ['Campaign Strategy', 'Audience Research', 'Copywriting', 'Channel Planning'],
    deliverables: [
      { id: 'd-1', title: 'Target audience analysis', description: 'Persona, insight, dan channel habits.' },
      { id: 'd-2', title: 'Campaign concept', description: 'Big idea dan 3 key messages.' },
      { id: 'd-3', title: 'Channel strategy', description: 'Pemilihan channel dan rationale.' },
      { id: 'd-4', title: 'Simple KPI plan', description: 'Target, baseline, dan cara ukur.' },
    ],
    resources: [
      { id: 'r-1', title: 'Brief Internship Program (PDF)', kind: 'document' },
      { id: 'r-2', title: 'Audience Insight Snapshot', kind: 'document' },
      { id: 'r-3', title: 'Contoh Campaign Deck', kind: 'template' },
    ],
    rewardPoints: 450,
    deadlineLabel: 'Jumat, 23:59 WIB',
    evaluation: marketingEvaluation,
  },
  {
    slug: 'candidate-screening-exercise',
    division: 'Human Resources',
    title: 'Candidate Screening Exercise',
    case:
      'Sebuah startup tahap awal membuka 3 posisi dan menerima 240 lamaran. Tim HR butuh bantuan untuk menyaring pelamar berdasarkan kualifikasi.',
    role:
      'Kamu berperan sebagai HR Associate yang harus membuat screening rubric dan memilih kandidat yang layak lanjut ke interview.',
    objective:
      'Menghasilkan screening rubric yang objektif dan daftar kandidat yang lolos ke tahap interview dengan justifikasi.',
    difficulty: 'Intermediate',
    effort: '3–5 jam',
    skills: ['Screening', 'Rubric Design', 'Decision Making', 'Communication'],
    deliverables: [
      { id: 'd-1', title: 'Screening rubric' },
      { id: 'd-2', title: 'Top 10 kandidat + justifikasi' },
      { id: 'd-3', title: 'Rekomendasi proses selanjutnya' },
    ],
    resources: [
      { id: 'r-1', title: 'Job Description Bundle', kind: 'document' },
      { id: 'r-2', title: 'Sample CV Pool (8 CV)', kind: 'document' },
    ],
    rewardPoints: 400,
    deadlineLabel: 'Jumat, 23:59 WIB',
  },
  {
    slug: 'dashboard-redesign-challenge',
    division: 'UI/UX',
    title: 'Dashboard Redesign Challenge',
    case:
      'Sebuah SaaS analytics memiliki dashboard yang informasinya padat tapi sulit dibaca user baru. Mereka meminta proposal redesign.',
    role:
      'Kamu berperan sebagai Product Designer yang harus memahami masalah dan menghasilkan proposal redesign.',
    objective:
      'Menghasilkan 1 case study redesign dengan problem framing, alternative exploration, dan high-fidelity mockup.',
    difficulty: 'Intermediate',
    effort: '6–8 jam',
    skills: ['UI Design', 'Information Architecture', 'Problem Framing', 'Visual Hierarchy'],
    deliverables: [
      { id: 'd-1', title: 'Problem framing' },
      { id: 'd-2', title: 'Sebelum & sesudah layout' },
      { id: 'd-3', title: 'High-fidelity mockup' },
      { id: 'd-4', title: 'Design rationale singkat' },
    ],
    resources: [
      { id: 'r-1', title: 'Current Dashboard Screens', kind: 'document' },
      { id: 'r-2', title: 'User Research Snippets', kind: 'document' },
    ],
    rewardPoints: 500,
    deadlineLabel: 'Jumat, 23:59 WIB',
  },
  {
    slug: 'data-insight-presentation',
    division: 'Data',
    title: 'Data Insight Presentation',
    case:
      'Tim marketing memiliki data campaign 6 bulan terakhir dan ingin tahu channel mana yang paling efisien.',
    role:
      'Kamu berperan sebagai Junior Data Analyst yang harus membersihkan data, menganalisis, dan mempresentasikan insight.',
    objective:
      'Menghasilkan 1 slide deck yang menjawab pertanyaan bisnis utama dengan visualisasi yang jelas.',
    difficulty: 'Intermediate',
    effort: '4–6 jam',
    skills: ['Data Analysis', 'Visualization', 'Storytelling', 'Spreadsheet'],
    deliverables: [
      { id: 'd-1', title: 'Cleaned dataset' },
      { id: 'd-2', title: 'Key visualizations' },
      { id: 'd-3', title: 'Insight presentation (5–7 slides)' },
    ],
    resources: [
      { id: 'r-1', title: 'Raw Campaign Data (CSV)', kind: 'dataset' },
      { id: 'r-2', title: 'Brief dari Tim Marketing', kind: 'document' },
    ],
    rewardPoints: 450,
    deadlineLabel: 'Jumat, 23:59 WIB',
  },
  {
    slug: 'pricing-experiment-brief',
    division: 'Business',
    title: 'Pricing Experiment Brief',
    case:
      'Sebuah edutech punya 2 paket langganan dan ingin menguji apakah harga baru bisa meningkatkan conversion.',
    role:
      'Kamu berperan sebagai Business Analyst yang harus merancang eksperimen pricing.',
    objective:
      'Menghasilkan brief eksperimen pricing: hypothesis, design, metric, dan risiko.',
    difficulty: 'Beginner',
    effort: '2–3 jam',
    skills: ['Business Analysis', 'Experimentation', 'Hypothesis Design'],
    deliverables: [
      { id: 'd-1', title: 'Hypothesis statement' },
      { id: 'd-2', title: 'Experiment design' },
      { id: 'd-3', title: 'Success metrics & risks' },
    ],
    resources: [
      { id: 'r-1', title: 'Current Pricing Page', kind: 'document' },
      { id: 'r-2', title: 'Conversion Baseline', kind: 'document' },
    ],
    rewardPoints: 300,
    deadlineLabel: 'Jumat, 23:59 WIB',
  },
  {
    slug: 'support-triage-automation',
    division: 'AI',
    title: 'Support Triage Automation',
    case:
      'Sebuah startup menerima ratusan tiket support per minggu. Mereka ingin otomatisasi untuk triase awal.',
    role:
      'Kamu berperan sebagai AI Engineer yang merancang sistem klasifikasi tiket sederhana.',
    objective:
      'Menghasilkan rancangan pipeline klasifikasi tiket (prompt atau model) plus evaluasi sederhana.',
    difficulty: 'Advanced',
    effort: '5–7 jam',
    skills: ['Prompt Design', 'Classification', 'Evaluation', 'Documentation'],
    deliverables: [
      { id: 'd-1', title: 'Kategori tiket & definisi' },
      { id: 'd-2', title: 'Prompt atau model design' },
      { id: 'd-3', title: 'Sample evaluation (20 tiket)' },
    ],
    resources: [
      { id: 'r-1', title: 'Sample Tickets (CSV)', kind: 'dataset' },
      { id: 'r-2', title: 'Panduan Prompt Engineering', kind: 'template' },
    ],
    rewardPoints: 550,
    deadlineLabel: 'Jumat, 23:59 WIB',
  },
];

export const mockWeekLabel = '24 – 28 Agustus 2026';
