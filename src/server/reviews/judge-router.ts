/**
 * Second-judge routing (PRD §27).
 *
 * The second judge does NOT run for every submission — only when the primary
 * review looks shaky. It always reviews independently (blind input again, a
 * different model profile). Pure module — safe for offline tests.
 */

/** Minimum overall confidence before a primary review is accepted outright. Tunable. */
export const REVIEW_CONFIDENCE_MIN = 0.7;

export interface JudgeRoutingInput {
  confidence: number;
  /** Validator warnings (e.g. thin evidence) that suggest a second opinion. */
  warningCount: number;
  /** Files the reviewer could not inspect (pending Tencent extraction, dead bytes). */
  hasUnextractedFiles: boolean;
}

export function needsSecondJudge(input: JudgeRoutingInput): { needed: boolean; reason: string | null } {
  if (input.confidence < REVIEW_CONFIDENCE_MIN) {
    return { needed: true, reason: `confidence ${input.confidence} below ${REVIEW_CONFIDENCE_MIN}` };
  }
  if (input.warningCount > 0 || input.hasUnextractedFiles) {
    return { needed: true, reason: "validator warnings or unextracted evidence" };
  }
  return { needed: false, reason: null };
}
