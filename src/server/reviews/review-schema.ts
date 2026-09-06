import { z } from "zod";

/**
 * Structured reviewer output contract (PRD §25).
 *
 * The model proposes per-criterion scores + evidence; the BACKEND computes the
 * weighted final score. The LLM is never the authority for final arithmetic.
 * Pure module — safe for offline tests.
 */

export const reviewerCriterionSchema = z.object({
  criterionId: z.string().uuid(),
  score: z.number().min(0).max(100),
  evidence: z.array(z.string().trim().min(1)).min(1).max(10),
  issues: z.array(z.string().trim().min(1)).max(10).default([]),
  confidence: z.number().min(0).max(1),
});

export const reviewerOutputSchema = z.object({
  criteria: z.array(reviewerCriterionSchema).min(1).max(20),
  strengths: z.array(z.string().trim().min(1)).max(10).default([]),
  priorityImprovements: z.array(z.string().trim().min(1)).max(10).default([]),
  confidence: z.number().min(0).max(1),
});

export type ReviewerCriterion = z.infer<typeof reviewerCriterionSchema>;
export type ReviewerOutput = z.infer<typeof reviewerOutputSchema>;

/** Schema caps for the advisory string arrays. */
const MAX_STRINGS = 10;

function asStringArray(value: unknown): unknown {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.slice(0, MAX_STRINGS);
  return value;
}

/**
 * Shape-only repair of a model's JSON, applied before validation.
 *
 * Real models return `issues: "..."` where the contract says `["..."]`, and
 * sometimes overrun the ten-item cap. Both are presentation slips, not grading
 * errors — rejecting the whole response for them throws away a correct set of
 * scores and spends one of the job's automation attempts.
 *
 * Deliberately limited to shape. A lone string becomes a one-item array and an
 * over-long list is capped; nothing that carries meaning is touched. Scores,
 * confidences and criterion ids must still arrive correct or the review fails,
 * `criteria` is never truncated (too many of them means the model invented
 * some, which must surface), and no content is ever invented here.
 */
export function normaliseReviewerOutput(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const output = { ...(raw as Record<string, unknown>) };
  output.strengths = asStringArray(output.strengths);
  output.priorityImprovements = asStringArray(output.priorityImprovements);
  if (Array.isArray(output.criteria)) {
    output.criteria = output.criteria.map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return entry;
      const criterion = { ...(entry as Record<string, unknown>) };
      criterion.evidence = asStringArray(criterion.evidence);
      criterion.issues = asStringArray(criterion.issues);
      return criterion;
    });
  }
  return output;
}
