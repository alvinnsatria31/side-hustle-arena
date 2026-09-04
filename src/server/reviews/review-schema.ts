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
