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

/**
 * The brief the participant was actually working from.
 *
 * Grading against a title and a rubric alone asks the reviewer to guess what
 * the task was. A criterion like "Does the deliverable answer the brief?"
 * cannot be applied without the brief, so the reviewer was inventing the
 * standard it graded against — and inventing it differently each run.
 *
 * None of these fields carry prior scores, attempts or feedback, so the review
 * stays blind in the sense PRD §28 means: blind to previous *judgements*, not
 * blind to the assignment.
 */
export interface BlindProjectBrief {
  caseBackground: string | null;
  roleDescription: string | null;
  mission: string | null;
  objective: string | null;
}

export interface BlindReviewerInput {
  attemptNumber: number;
  projectTitle: string;
  divisionName: string;
  brief: BlindProjectBrief;
  rubric: BlindRubricCriterion[];
  explanation: string | null;
  notes: string | null;
  items: BlindVersionItem[];
  sources?: ReviewSource[];
  /**
   * What the reviewer can and cannot actually judge from this evidence.
   *
   * An image reaches the model as OCR text, so a screenshot of an interface
   * supports a judgement about its wording and almost none about its visual
   * design; a link is fetched as a document, not rendered and clicked. Saying
   * so in the input is what keeps a confident score off a criterion the
   * evidence cannot support.
   */
  evidenceLimits: string[];
}

export interface ReviewSource {
  id: string;
  kind: string;
  text: string;
  sha256: string;
}

/**
 * What this pipeline genuinely cannot assess, stated per artifact kind.
 *
 * Deliberately conservative and specific. "Cannot evaluate visual design" is
 * useful to a reviewer; a vague "some evidence may be incomplete" is not.
 */
export function describeEvidenceLimits(items: BlindVersionItem[]): string[] {
  const limits: string[] = [];
  if (items.some((item) => item.mimeType?.startsWith("image/"))) {
    limits.push("Image artifacts reach you as OCR text only. Judge the wording and content you can read; do not score visual design, layout or colour, and say so in your issues if a criterion depends on them.");
  }
  if (items.some((item) => item.itemType === "LINK")) {
    limits.push("Links are fetched as a single document. Nothing was clicked, no script ran and no logged-in state was reached, so interactive or functional behaviour is not evidenced here.");
  }
  if (items.some((item) => item.itemType === "FILE" && !item.mimeType?.startsWith("image/"))) {
    limits.push("Document artifacts reach you as extracted text. Formatting, embedded charts and images inside them are not visible to you.");
  }
  return limits;
}

export function buildBlindReviewerInput(input: {
  attemptNumber: number;
  projectTitle: string;
  divisionName: string;
  brief?: Partial<BlindProjectBrief>;
  rubric: BlindRubricCriterion[];
  explanation: string | null;
  notes: string | null;
  items: BlindVersionItem[];
}): BlindReviewerInput {
  return {
    attemptNumber: input.attemptNumber,
    projectTitle: input.projectTitle,
    divisionName: input.divisionName,
    brief: {
      caseBackground: input.brief?.caseBackground ?? null,
      roleDescription: input.brief?.roleDescription ?? null,
      mission: input.brief?.mission ?? null,
      objective: input.brief?.objective ?? null,
    },
    rubric: input.rubric,
    explanation: input.explanation,
    notes: input.notes,
    items: input.items,
    evidenceLimits: describeEvidenceLimits(input.items),
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
