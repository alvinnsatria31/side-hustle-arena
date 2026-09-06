import type { ParticipantOverview } from '@/server/arena/participant-service';

type ReportSource = Pick<ParticipantOverview, 'history' | 'skillEvidence' | 'points'>;
const average = (values: number[]) => values.length
  ? Math.round(values.reduce((sum, score) => sum + score, 0) / values.length * 10) / 10
  : null;

/** Evidence scores describe reviewed work, never a probability of being hired. */
export function buildCareerReport(source: ReportSource) {
  const completed = source.history.filter(row => !row.sealed && row.week.status === 'FINALIZED' && row.status !== 'VOIDED' && row.ranking);
  const evidence = source.skillEvidence.filter(item => completed.some(row => row.project.slug === item.projectSlug && row.week.weekCode === item.weekCode));
  const grouped = new Map<string, { id: string; name: string; scores: number[] }>();
  for (const item of evidence) {
    const skill = grouped.get(item.skillId) ?? { id: item.skillId, name: item.name, scores: [] };
    skill.scores.push(item.score);
    grouped.set(item.skillId, skill);
  }
  const skills = [...grouped.values()].map(skill => ({
    id: skill.id, name: skill.name, score: average(skill.scores)!, evidenceCount: skill.scores.length,
  })).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const scores = completed.map(row => row.ranking!.finalScore);
  const averageScore = average(scores);
  const previousAverage = average(scores.slice(1));
  return {
    projectsCompleted: completed.length,
    averageScore,
    previousAverage,
    scoreChange: averageScore !== null && previousAverage !== null ? Math.round((averageScore - previousAverage) * 10) / 10 : null,
    points: source.points,
    skills,
    history: completed.map(row => ({
      id: row.id, projectSlug: row.project.slug, title: row.project.title, category: row.project.division,
      weekCode: row.week.weekCode, completedAt: row.week.finalizedAt,
      score: row.ranking!.finalScore, rank: row.ranking!.rank, pointsAwarded: row.ranking!.pointsAwarded,
      skills: [...new Set(evidence.filter(item => item.projectSlug === row.project.slug && item.weekCode === row.week.weekCode).map(item => item.name))],
    })),
  };
}

export type CareerReport = ReturnType<typeof buildCareerReport>;
