import type { WeeklyWinner } from '@/types/winner';

export const mockWinners: WeeklyWinner[] = [
  {
    rank: 1,
    name: 'Riani Putri',
    initials: 'RP',
    division: 'Marketing',
    projectTitle: 'Social Media Launch Strategy',
    score: 94,
    skills: ['Campaign Strategy', 'Analytics', 'Copywriting', 'Channel Planning'],
    summary:
      'Strategi yang matang dengan target metric yang realistis dan eksekusi pesan yang konsisten di semua channel.',
  },
  {
    rank: 2,
    name: 'Bagas Mahendra',
    initials: 'BM',
    division: 'Data',
    projectTitle: 'Data Insight Presentation',
    score: 89,
    skills: ['Data Analysis', 'Visualization', 'Storytelling'],
    summary:
      'Visualisasi data yang bersih dan storytelling yang kuat — langsung menjawab pertanyaan bisnis utama.',
  },
  {
    rank: 3,
    name: 'Sasha Wibowo',
    initials: 'SW',
    division: 'UI/UX',
    projectTitle: 'Dashboard Redesign Challenge',
    score: 86,
    skills: ['UI Design', 'Information Architecture', 'Visual Hierarchy'],
    summary:
      'Problem framing yang tajam dan mockup dengan hierarki visual yang terasa lebih ringan untuk user baru.',
  },
];
