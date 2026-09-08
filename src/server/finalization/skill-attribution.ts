/**
 * What a week's result actually says about each individual skill.
 *
 * Finalization used to write the project's overall final score onto every skill
 * the project touched. A submission scoring 82 produced "Excel: 82, SQL: 82,
 * Communication: 82" — three claims, one measurement, and no way for a reader
 * to tell. That number then travelled: the Career Report averaged it per skill,
 * and Jobs treated its existence as proof of the skill.
 *
 * A rubric criterion is the only thing that measures anything. So where a
 * criterion is attributed to a skill, that skill's score is computed from the
 * criteria that measured it. Where nothing is attributed, the row is still
 * written — the participant did work involving that skill, and that is worth
 * recording — but it is labelled PROJECT, so every reader knows it is the
 * project's score standing in, not a measurement of that skill.
 *
 * Pure: no database, no dates, no rounding surprises.
 */

export type SkillAttribution = "CRITERION" | "PROJECT";

export interface AttributionCriterion {
  id: string;
  /** Which skill this criterion measures, if a curator said so. */
  skillId: string | null;
  weight: number;
  maxScore: number;
}

export interface AttributionScore {
  rubricCriterionId: string;
  /** Raw score on the criterion's own scale. */
  rawScore: number;
  maxScore: number;
}

export interface SkillEvidenceRow {
  skillId: string;
  /** 0–100. */
  score: number;
  attribution: SkillAttribution;
  /** How many rubric criteria fed this score. Zero means PROJECT. */
  criterionCount: number;
}

const clamp = (value: number) => Math.min(100, Math.max(0, value));

/**
 * @param projectSkills every skill the project claims to exercise
 * @param criteria the project's rubric, with any skill attribution
 * @param scores the review's per-criterion scores
 * @param projectScore the submission's overall final score, 0–100
 */
export function attributeSkillEvidence(input: {
  projectSkills: string[];
  criteria: AttributionCriterion[];
  scores: AttributionScore[];
  projectScore: number;
}): SkillEvidenceRow[] {
  const scoreByCriterion = new Map(input.scores.map((score) => [score.rubricCriterionId, score]));
  const bySkill = new Map<string, { weighted: number; weight: number; count: number }>();

  for (const criterion of input.criteria) {
    if (!criterion.skillId) continue;
    const score = scoreByCriterion.get(criterion.id);
    // A criterion the review did not score cannot contribute. Treating a
    // missing score as zero would punish a participant for an incomplete
    // review, which is an infrastructure failure, not their work.
    if (!score) continue;
    const max = score.maxScore || criterion.maxScore;
    if (!(max > 0)) continue;
    const weight = criterion.weight > 0 ? criterion.weight : 1;
    const bucket = bySkill.get(criterion.skillId) ?? { weighted: 0, weight: 0, count: 0 };
    // Normalised to 0–100 first, so criteria with different maximums combine.
    bucket.weighted += (score.rawScore / max) * 100 * weight;
    bucket.weight += weight;
    bucket.count += 1;
    bySkill.set(criterion.skillId, bucket);
  }

  const unique = [...new Set(input.projectSkills)];
  return unique.map((skillId) => {
    const measured = bySkill.get(skillId);
    if (measured && measured.weight > 0) {
      return {
        skillId,
        score: Math.round(clamp(measured.weighted / measured.weight) * 100) / 100,
        attribution: "CRITERION" as const,
        criterionCount: measured.count,
      };
    }
    return {
      skillId,
      score: Math.round(clamp(input.projectScore) * 100) / 100,
      attribution: "PROJECT" as const,
      criterionCount: 0,
    };
  });
}

/**
 * Is a project's rubric wired up well enough for per-skill scoring?
 *
 * Surfaced to admins so an un-attributed rubric is visible as a content gap
 * rather than silently degrading every result it produces.
 */
export function attributionCoverage(criteria: AttributionCriterion[], projectSkills: string[]): {
  attributedCriteria: number;
  totalCriteria: number;
  measuredSkills: number;
  totalSkills: number;
} {
  const attributed = criteria.filter((criterion) => criterion.skillId);
  const measured = new Set(attributed.map((criterion) => criterion.skillId!));
  return {
    attributedCriteria: attributed.length,
    totalCriteria: criteria.length,
    measuredSkills: [...new Set(projectSkills)].filter((skill) => measured.has(skill)).length,
    totalSkills: new Set(projectSkills).size,
  };
}
