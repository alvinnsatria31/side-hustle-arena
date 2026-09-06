/**
 * Blind reviewer input builder (PRD §28).
 *
 * A re-review attempt must be graded BLIND: the reviewer sees ONLY the current
 * version content + rubric. Previous scores, previous feedback, and attempt
 * history are never included — they would anchor the new score. Comparison
 * feedback ("what improved") is generated only AFTER the current score is
 * locked, via buildImprovementFeedback().
 *
 * Pure module — safe for offline tests.
 */

export interface BlindRubricCriterion {
  id: string;
  name: string;
  description: string | null;
  weight: number;
  maxScore: number;
  reviewInstruction: string | null;
}

export interface BlindVersionItem {
  itemType: "FILE" | "LINK" | "TEXT";
  label: string | null;
  externalUrl: string | null;
  originalFilename: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  /** Short-lived download URL when available, else null (pending extraction). */
  downloadUrl: string | null;
}

export interface BlindReviewerInput {
  attemptNumber: number;
  projectTitle: string;
  divisionName: string;
  rubric: BlindRubricCriterion[];
  explanation: string | null;
  notes: string | null;
  items: BlindVersionItem[];
  sources?: ReviewSource[];
}

export interface ReviewSource {
  id: string;
  kind: string;
  text: string;
  sha256: string;
}

export function buildBlindReviewerInput(input: {
  attemptNumber: number;
  projectTitle: string;
  divisionName: string;
  rubric: BlindRubricCriterion[];
  explanation: string | null;
  notes: string | null;
  items: BlindVersionItem[];
}): BlindReviewerInput {
  return {
    attemptNumber: input.attemptNumber,
    projectTitle: input.projectTitle,
    divisionName: input.divisionName,
    rubric: input.rubric,
    explanation: input.explanation,
    notes: input.notes,
    items: input.items,
  };
}

export interface LockedCriterionScore {
  criterionId: string;
  criterionName: string;
  score: number;
}

/**
 * Post-lock improvement feedback (PRD §29). Called only after the current
 * attempt's scores are persisted, comparing against the previous VALID
 * reviewed attempt (FAILED-access versions never count).
 */
export function buildImprovementFeedback(input: {
  current: LockedCriterionScore[];
  previous: LockedCriterionScore[];
}): { improved: string[]; stillNeedsWork: string[] } {
  const previousById = new Map(input.previous.map((c) => [c.criterionId, c.score]));
  const deltas = input.current.map((c) => ({
    name: c.criterionName,
    delta: c.score - (previousById.get(c.criterionId) ?? c.score),
    score: c.score,
  }));
  const improved = deltas
    .filter((d) => d.delta >= 5)
    .sort((a, b) => b.delta - a.delta)
    .map((d) => `${d.name} (+${Math.round(d.delta)} pts)`);
  const stillNeedsWork = [...deltas]
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((d) => d.name);
  return { improved, stillNeedsWork };
}
