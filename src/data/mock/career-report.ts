import type { CareerReport } from '@/types/report';

export const mockCareerReport: CareerReport = {
  projectsCompleted: 8,
  averageScore: 83,
  bestSkill: 'Presentation',
  currentStreakWeeks: 4,
  skills: [
    { id: 'sk-1', label: 'Marketing Strategy', score: 82 },
    { id: 'sk-2', label: 'Copywriting', score: 76 },
    { id: 'sk-3', label: 'Analytics', score: 68 },
    { id: 'sk-4', label: 'Presentation', score: 85 },
    { id: 'sk-5', label: 'Problem Solving', score: 80 },
    { id: 'sk-6', label: 'Communication', score: 79 },
  ],
  growth: [
    { weekLabel: 'Week 1', score: 72 },
    { weekLabel: 'Week 2', score: 76 },
    { weekLabel: 'Week 3', score: 81 },
    { weekLabel: 'Week 4', score: 84 },
  ],
  history: [
    {
      id: 'h-1',
      title: 'Social Media Launch Strategy',
      division: 'Marketing',
      score: 84,
      date: '2025-08-23',
    },
    {
      id: 'h-2',
      title: 'Candidate Screening Exercise',
      division: 'Human Resources',
      score: 80,
      date: '2025-08-16',
    },
    {
      id: 'h-3',
      title: 'Dashboard Redesign Challenge',
      division: 'UI/UX',
      score: 88,
      date: '2025-08-09',
    },
    {
      id: 'h-4',
      title: 'Data Insight Presentation',
      division: 'Data',
      score: 81,
      date: '2025-08-02',
    },
  ],
};
