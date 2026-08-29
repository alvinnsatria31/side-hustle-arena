import type { CVAnalysis } from '@/types/cv';

export const mockCVAnalysis: CVAnalysis = {
  score: 78,
  status: 'good',
  statusLabel: 'GOOD',
  summary:
    'CV kamu sudah cukup kuat, tapi ada beberapa area yang bisa ditingkatkan untuk lolos screening ATS dan menarik perhatian recruiter.',
  metrics: [
    {
      key: 'ats',
      label: 'ATS Compatibility',
      score: 84,
      description: 'Heading dan struktur sudah mudah dibaca sistem ATS.',
    },
    {
      key: 'content',
      label: 'Content Impact',
      score: 72,
      description: 'Bullet pengalaman masih terlalu umum, belum sepenuhnya outcome-driven.',
    },
    {
      key: 'keywords',
      label: 'Skills & Keywords',
      score: 70,
      description: 'Sebagian besar skill target muncul, tetapi beberapa masih kurang spesifik.',
    },
    {
      key: 'readability',
      label: 'Readability',
      score: 86,
      description: 'Format tanggal konsisten dan section mudah di-scan.',
    },
    {
      key: 'recruiter',
      label: 'Recruiter Readiness',
      score: 78,
      description: 'Informasi utama sudah jelas, namun ringkasan profesional bisa lebih kuat.',
    },
  ],
  priorityIssues: [
    {
      id: 'issue-1',
      rank: 1,
      title: 'Bullet pengalaman masih task-oriented',
      explanation:
        'Sebagian besar bullet menjelaskan apa yang kamu kerjakan, bukan hasil atau dampak yang kamu hasilkan. Recruiter ingin melihat outcome.',
      suggestion:
        'Ubah setiap bullet menjadi hasil, angka, atau dampak yang terukur. Gunakan format: action + angka + konteks.',
      priority: 'high',
    },
    {
      id: 'issue-2',
      rank: 2,
      title: 'Belum cukup measurable achievements',
      explanation:
        'Hanya 2 dari 7 bullet pengalaman yang memuat angka atau metrik. CV tanpa angka lebih sulit dilacak recruiter.',
      suggestion:
        'Tambahkan minimal 1 angka pada setiap pengalaman: %, jumlah orang, nominal, atau durasi.',
      priority: 'high',
    },
    {
      id: 'issue-3',
      rank: 3,
      title: 'Beberapa skill target role belum muncul',
      explanation:
        'Skill seperti "Performance Reporting" dan "A/B Testing" tidak ditemukan, padahal umum untuk role Marketing Analyst.',
      suggestion:
        'Tambahkan skill yang relevan dengan target role, terutama yang muncul di Job Description.',
      priority: 'medium',
    },
  ],
  strengths: [
    { id: 's-1', title: 'Struktur pengalaman jelas', description: 'Section pengalaman dipisah per role dengan urutan kronologis.' },
    { id: 's-2', title: 'Heading mudah terbaca ATS', description: 'Heading pakai label standar: Experience, Education, Skills.' },
    { id: 's-3', title: 'Format tanggal konsisten' },
    { id: 's-4', title: 'Informasi utama mudah ditemukan', description: 'Nama, kontak, dan ringkasan ada di posisi teratas.' },
  ],
  beforeAfter: {
    id: 'ba-1',
    before: 'Mengelola social media perusahaan.',
    after:
      'Meningkatkan engagement Instagram sebesar 38% dalam 3 bulan melalui content planning dan weekly performance analysis.',
    rationale:
      'Bullet "after" memuat angka (38%), durasi (3 bulan), dan jelas menyebut strategi. Bullet "before" hanya menjelaskan tugas tanpa dampak.',
  },
  keywordMatch: {
    score: 67,
    found: ['Content Strategy', 'Analytics', 'Campaign Management', 'Copywriting'],
    missing: ['Google Analytics', 'Performance Reporting', 'A/B Testing', 'SEO'],
  },
  recommendations: [
    {
      id: 'rec-1',
      trigger: 'weak_achievement',
      title: 'AI CV Bullet Rewriter',
      description: 'Ubah bullet pengalaman menjadi outcome-driven dengan saran instan.',
      cta: 'Coba Rewriter',
    },
    {
      id: 'rec-2',
      trigger: 'low_keyword',
      title: 'Job Match Optimizer',
      description: 'Lihat skill dan keyword yang hilang untuk role yang kamu incar.',
      cta: 'Optimalkan CV',
    },
    {
      id: 'rec-3',
      trigger: 'bad_structure',
      title: 'CV Builder',
      description: 'Bangun CV ATS-friendly dari template yang sudah teruji.',
      cta: 'Mulai dari Template',
    },
  ],
};
