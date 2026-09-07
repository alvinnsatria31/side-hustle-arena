import type { ParticipantOverview } from '@/server/arena/participant-service';

type ReportSource = Pick<ParticipantOverview, 'history' | 'skillEvidence' | 'points'> & {
  /** The participant's most recent saved CV analysis, or null if they have none. */
  cv?: CvSummary | null;
};

/** The parts of a stored CV analysis the report is allowed to read. */
export interface CvSummary {
  score: number;
  statusLabel: string;
  fileName: string;
  analyzedAt: string;
  evidence: Array<{ skill: string; level: 'kuat' | 'cukup' | 'kurang' | 'belum'; note: string }>;
}

/** Same skill, written differently. Not clever on purpose — see buildCareerReport. */
const normaliseSkill = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ');
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
  // The CV and the Arena are two different kinds of claim, and the report keeps
  // them apart deliberately. A CV says what someone states about themselves; the
  // Arena says what a reviewer observed in submitted work. Averaging the two
  // would launder the first into the second, so the CV score is carried through
  // untouched and the only thing joined is WHICH skills each one names.
  //
  // Matching is a normalised string compare and nothing more. "no Arena evidence
  // yet" therefore means exactly that — not that the claim is false, and not
  // that the skill is absent. A participant who wrote "Ms. Excel" against an
  // Arena skill named "Excel" lands in `unevidenced`, which is the honest
  // answer for a matcher this simple.
  const evidencedByName = new Map(skills.map(skill => [normaliseSkill(skill.name), skill]));
  const cv = source.cv
    ? {
      score: source.cv.score,
      statusLabel: source.cv.statusLabel,
      fileName: source.cv.fileName,
      analyzedAt: source.cv.analyzedAt,
      claimedSkills: source.cv.evidence.map(claim => {
        const matched = evidencedByName.get(normaliseSkill(claim.skill));
        return {
          name: claim.skill,
          level: claim.level,
          evidencedScore: matched?.score ?? null,
          evidenceCount: matched?.evidenceCount ?? 0,
        };
      }),
    }
    : null;

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
    cv: cv && {
      ...cv,
      /** Claims the Arena has actually reviewed work for. */
      corroborated: cv.claimedSkills.filter(claim => claim.evidenceCount > 0).length,
      /** Claims with no Arena evidence yet — a gap to close, not a contradiction. */
      unevidenced: cv.claimedSkills.filter(claim => claim.evidenceCount === 0).length,
    },
    history: completed.map(row => ({
      id: row.id, projectSlug: row.project.slug, title: row.project.title, category: row.project.division,
      weekCode: row.week.weekCode, completedAt: row.week.finalizedAt,
      score: row.ranking!.finalScore, rank: row.ranking!.rank, pointsAwarded: row.ranking!.pointsAwarded,
      skills: [...new Set(evidence.filter(item => item.projectSlug === row.project.slug && item.weekCode === row.week.weekCode).map(item => item.name))],
    })),
  };
}

export type CareerReport = ReturnType<typeof buildCareerReport>;
