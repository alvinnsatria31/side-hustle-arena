import type { PortfolioProject } from '@/types/portfolio';

export const mockPortfolio: PortfolioProject[] = [
  {
    id: 'p-1',
    title: 'Social Media Launch Strategy',
    role: 'Junior Marketing Strategist',
    division: 'Marketing',
    period: 'Agustus 2025',
    skills: ['Campaign Strategy', 'Analytics', 'Copywriting', 'Channel Planning'],
    score: 84,
    status: 'published',
    summary:
      'Merancang strategi campaign untuk meningkatkan sign-ups program internship pada mahasiswa semester 5–7.',
    challenge:
      'Platform career sedang kesulitan menjangkau mahasiswa baru dan membutuhkan strategi yang lebih relevan untuk program internship-nya.',
    approach:
      'Mulai dengan audience research untuk memahami channel habits dan pain point, lalu menyusun big idea campaign yang fokus pada relevansi karier di tahun pertama.',
    result:
      'Strategi menghasilkan channel plan dan pesan yang siap dijalankan dalam 3 minggu dengan target conversion 30%.',
    deliverables: [
      'Target audience analysis',
      'Campaign concept & 3 key messages',
      'Channel strategy',
      'Simple KPI plan',
    ],
    evaluatorQuote:
      'Strategi channel konsisten dengan target audience yang dipilih. Pesan campaign mudah dipahami dan punya diferensiasi jelas.',
    featured: true,
  },
  {
    id: 'p-2',
    title: 'Data Insight Presentation',
    role: 'Junior Data Analyst',
    division: 'Data',
    period: 'Agustus 2025',
    skills: ['Data Analysis', 'Visualization', 'Storytelling'],
    score: 81,
    status: 'published',
    summary:
      'Menganalisis data campaign 6 bulan dan mempresentasikan channel paling efisien untuk tim marketing.',
    challenge:
      'Tim marketing punya banyak data tapi belum punya jawaban jelas channel mana yang paling efisien.',
    approach:
      'Membersihkan dataset, memetakan metrik per channel, lalu memvisualisasikan hasil dalam slide deck dengan narrative yang terstruktur.',
    result:
      'Menghasilkan 5-slide insight deck yang langsung dipakai sebagai input rapat planning berikutnya.',
    deliverables: ['Cleaned dataset', 'Key visualizations', 'Insight presentation'],
  },
  {
    id: 'p-3',
    title: 'Dashboard Redesign Challenge',
    role: 'Product Designer',
    division: 'UI/UX',
    period: 'Agustus 2025',
    skills: ['UI Design', 'Information Architecture', 'Visual Hierarchy'],
    score: 88,
    status: 'draft',
    summary:
      'Mendesain ulang dashboard analytics yang informasinya padat tapi sulit dibaca user baru.',
    challenge: 'User baru kesulitan menavigasi dashboard analytics karena layout terlalu padat.',
    approach:
      'Problem framing dengan user pain points, eksplorasi layout alternatif, dan iterasi high-fidelity mockup.',
    result: 'Mockup redesign dengan hierarki visual yang lebih ringan dan clear next action.',
    deliverables: ['Problem framing', 'Before & after layout', 'High-fidelity mockup'],
  },
];
