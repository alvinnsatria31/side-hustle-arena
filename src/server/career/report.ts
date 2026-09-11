import type { ParticipantOverview } from '@/server/arena/participant-service';
import { isPublishedWeekStatus } from '@/server/arena/published-weeks';
import { normalizeText } from './jobs/text';

type ReportSource = Pick<ParticipantOverview, 'history' | 'skillEvidence' | 'points'> & {
  /** The participant's most recent saved CV analysis, or null if they have none. */
  cv?: CvSummary | null;
  /**
   * The shared taxonomy resolver, injected so this module stays pure and the
   * CV/Arena join uses the same vocabulary as Jobs.
   */
  resolveSkill?: (name: string) => string | null;
};

/** The parts of a stored CV analysis the report is allowed to read. */
export interface CvSummary {
  score: number;
  statusLabel: string;
  fileName: string;
  analyzedAt: string;
  evidence: Array<{ skill: string; level: 'kuat' | 'cukup' | 'kurang' | 'belum'; note: string }>;
}

const average = (values: number[]) => values.length
  ? Math.round(values.reduce((sum, score) => sum + score, 0) / values.length * 10) / 10
  : null;

/** Evidence scores describe reviewed work, never a probability of being hired. */
export function buildCareerReport(source: ReportSource) {
  const completed = source.history.filter(row => !row.sealed && isPublishedWeekStatus(row.week.status) && row.status !== 'VOIDED' && row.ranking);
  const evidence = source.skillEvidence.filter(item => completed.some(row => row.project.slug === item.projectSlug && row.week.weekCode === item.weekCode));
  // Measured and inherited evidence are averaged separately, and the headline
  // score prefers the measured one.
  //
  // A PROJECT-attributed row records that the participant did work involving
  // the skill; it is the project's overall score standing in, because no rubric
  // criterion measures that skill yet. Averaging it together with real
  // per-criterion measurements would launder one into the other — which is the
  // exact thing that made "Excel 82, SQL 82, Communication 82" look like three
  // findings instead of one.
  const grouped = new Map<string, { id: string; name: string; measured: number[]; inherited: number[] }>();
  for (const item of evidence) {
    const skill = grouped.get(item.skillId) ?? { id: item.skillId, name: item.name, measured: [], inherited: [] };
    if (item.attribution === 'CRITERION') skill.measured.push(item.score);
    else skill.inherited.push(item.score);
    grouped.set(item.skillId, skill);
  }
  const skills = [...grouped.values()].map(skill => {
    const measuredScore = average(skill.measured);
    const inheritedScore = average(skill.inherited);
    return {
      id: skill.id,
      name: skill.name,
      /** The number to show. Null when nothing has measured this skill yet. */
      score: measuredScore,
      /** How many reviews scored rubric criteria attributed to this skill. */
      measuredCount: skill.measured.length,
      /**
       * The project score carried by work that involved this skill without
       * measuring it. Shown as context, never as the skill's score.
       */
      projectScore: inheritedScore,
      projectEvidenceCount: skill.inherited.length,
      evidenceCount: skill.measured.length + skill.inherited.length,
    };
  }).sort((a, b) =>
    (b.score ?? -1) - (a.score ?? -1)
    || b.measuredCount - a.measuredCount
    || a.name.localeCompare(b.name));
  // The CV and the Arena are two different kinds of claim, and the report keeps
  // them apart deliberately. A CV says what someone states about themselves; the
  // Arena says what a reviewer observed in submitted work. Averaging the two
  // would launder the first into the second, so the CV score is carried through
  // untouched and the only thing joined is WHICH skills each one names.
  //
  // Matching goes through the shared skill taxonomy — the same index Jobs uses
  // — so "Ms. Excel" on a CV and "Excel" in Arena resolve to one skill instead
  // of being reported as an unevidenced claim. A name the taxonomy does not
  // know still lands in `unevidenced`, which remains the honest answer: it
  // means "no Arena evidence yet", not that the claim is false.
  const resolve = source.resolveSkill ?? (() => null);
  const byId = new Map(skills.map(skill => [skill.id, skill]));
  const evidencedByName = new Map(skills.map(skill => [normalizeText(skill.name), skill]));
  const cv = source.cv
    ? {
      score: source.cv.score,
      statusLabel: source.cv.statusLabel,
      fileName: source.cv.fileName,
      analyzedAt: source.cv.analyzedAt,
      claimedSkills: source.cv.evidence.map(claim => {
        const resolvedId = resolve(claim.skill);
        const matched = (resolvedId ? byId.get(resolvedId) : undefined) ?? evidencedByName.get(normalizeText(claim.skill));
        return {
          name: claim.skill,
          level: claim.level,
          evidencedScore: matched?.score ?? null,
          evidenceCount: matched?.evidenceCount ?? 0,
          /** Whether the taxonomy recognised this claim's wording at all. */
          resolvedToTaxonomy: Boolean(resolvedId ?? matched),
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
