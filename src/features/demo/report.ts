import type { CareerReportData, SkillLevel } from '@/types/report';
import type { DemoState } from '@/features/demo/store';
import { NEXT_PROJECT_SLUG } from '@/data/mock/projects';
import { MOCK_JOB_MATCHES } from '@/data/mock/jobs';

/** Static proficiency per known skill (demo-only scoring). */
const SKILL_LEVELS: Record<string, number> = {
  'Data Visualization': 91,
  Excel: 86,
  'Business Analysis': 78,
  'Business Insight': 83,
  Communication: 74,
  'Data Cleaning': 79,
  SQL: 61,
  Presentation: 64,
  HTML: 82,
  CSS: 84,
  Responsive: 80,
  JavaScript: 68,
  'Content Strategy': 76,
  Copywriting: 72,
  Figma: 70,
  'UX Flow': 69,
};

const ALWAYS_WEAK: SkillLevel[] = [
  { name: 'SQL', score: 61, weak: true },
  { name: 'Presentation', score: 64, weak: true },
];

function levelFor(skill: string): number {
  return SKILL_LEVELS[skill] ?? 70;
}

export function buildCareerReport(state: DemoState): CareerReportData {
  const history = [...state.completedHistory].sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
  );

  const average =
    history.length > 0
      ? Math.round(history.reduce((sum, h) => sum + h.score, 0) / history.length)
      : 0;
  const previousAverage = history.length > 1 ? Math.round((average * history.length - history[0].score) / (history.length - 1)) : average;

  const proven: SkillLevel[] = Array.from(new Set(state.skillsProven))
    .map((name) => ({ name, score: levelFor(name) }))
    .sort((a, b) => b.score - a.score);

  return {
    progress: 72,
    progressTrend: '↑ +8 bulan ini',
    projectsCompleted: history.length,
    skillsProvenCount: proven.length,
    averageScore: average,
    previousAverage,
    careerPoints: state.careerPoints,
    level: state.careerPoints >= 600 ? 'Level 4 · Builder' : state.careerPoints >= 400 ? 'Level 3 · Explorer' : 'Level 2 · Starter',
    strongestSkills: proven.slice(0, 4),
    needsImprovement: ALWAYS_WEAK,
    history: history.slice(0, 5),
    nextProjectSlug: NEXT_PROJECT_SLUG,
    nextProjectReason: 'SQL masih menjadi salah satu skill yang perlu diperkuat. Project ini akan membangun bukti kuat di area itu.',
    jobs: {
      matches: 24,
      topFit: MOCK_JOB_MATCHES[0].title + ' · ' + MOCK_JOB_MATCHES[0].location,
      matchScore: MOCK_JOB_MATCHES[0].matchScore,
    },
  };
}
