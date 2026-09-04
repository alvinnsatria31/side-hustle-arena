import type { BlindRubricCriterion } from "./reviewer-input";
import type { ReviewerCriterion } from "./review-schema";

/**
 * Backend score arithmetic (PRD §20, §25).
 *
 * The model proposes criterion scores; the BACKEND computes the weighted
 * final. Pure module — safe for offline tests.
 */

export interface CriterionScoreRow {
  rubricCriterionId: string;
  rawScore: number;
  maxScore: number;
  weightedScore: number;
}

export function computeWeightedScore(
  criteria: ReviewerCriterion[],
  rubric: BlindRubricCriterion[],
): { aiScore: number; rows: CriterionScoreRow[] } {
  const rubricById = new Map(rubric.map((c) => [c.id, c]));
  const totalWeight = rubric.reduce((sum, c) => sum + c.weight, 0);
  if (totalWeight <= 0) throw new Error("Rubric total weight must be positive.");
  let weightedSum = 0;
  const rows: CriterionScoreRow[] = criteria.map((criterion) => {
    const rubricCriterion = rubricById.get(criterion.criterionId);
    if (!rubricCriterion) throw new Error(`Unknown criterion id: ${criterion.criterionId}`);
    const normalized = criterion.score / rubricCriterion.maxScore;
    const weightedScore = (normalized * rubricCriterion.weight * 100) / totalWeight;
    weightedSum += weightedScore;
    return {
      rubricCriterionId: criterion.criterionId,
      rawScore: criterion.score,
      maxScore: rubricCriterion.maxScore,
      weightedScore: Math.round(weightedScore * 100) / 100,
    };
  });
  return { aiScore: Math.round(weightedSum * 100) / 100, rows };
}

/** PRD §27 recommended initial disagreement threshold (tunable). */
export const SECOND_JUDGE_DISAGREEMENT_POINTS = 12;

export function secondJudgeDisagrees(firstScore: number, secondScore: number): boolean {
  return Math.abs(firstScore - secondScore) >= SECOND_JUDGE_DISAGREEMENT_POINTS;
}
