import type { BlindReviewerInput } from "./reviewer-input";
import type { ReviewerOutput } from "./review-schema";

/**
 * Model profile router (PRD §43).
 *
 * Never hardcode one model/provider as a business dependency. Each pipeline
 * stage names a PROFILE; configuration maps profiles to concrete models.
 * Pure module — safe for offline tests.
 */

export const PROMPT_VERSION = "arena-reviewer-v1";

export type ReviewModelProfile = "review" | "validate" | "judge" | "generation";

export interface ModelCall {
  profile: ReviewModelProfile;
  model: string;
  input: BlindReviewerInput;
}

export interface ReviewProvider {
  readonly name: string;
  review(call: ModelCall): Promise<ReviewerOutput>;
}

/**
 * Deterministic development stub. Clearly labeled (`stub-dev-v1`), stable per
 * input so tests and demos are reproducible, and NEVER valid for production:
 * worker startup refuses it unless APP_ENV=development.
 */
export interface StubProviderOptions {
  /** Override overall confidence (default 0.8). Lower it to force second-judge routing in tests. */
  confidence?: number;
  /** Shift every criterion score by this many points (clamped 0..max). */
  scoreShift?: number;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

export class StubReviewProvider implements ReviewProvider {
  readonly name = "stub-dev-v1";
  private readonly options: StubProviderOptions;
  constructor(options: StubProviderOptions = {}) {
    this.options = options;
  }

  async review(call: ModelCall): Promise<ReviewerOutput> {
    const { confidence = 0.8, scoreShift = 0 } = this.options;
    const seedBase = `${call.profile}:${call.input.projectTitle}:${call.input.attemptNumber}`;
    return {
      criteria: call.input.rubric.map((criterion) => {
        const variance = (hashString(`${seedBase}:${criterion.id}`) % 21) - 10;
        const score = Math.min(criterion.maxScore, Math.max(0, 70 + variance + scoreShift));
        const evidenceSource = call.input.explanation ?? call.input.notes ?? call.input.projectTitle;
        return {
          criterionId: criterion.id,
          score,
          evidence: [`Observed in submission: "${evidenceSource.slice(0, 120)}"`],
          issues: score < 60 ? ["Below the competent band — see priority improvements."] : [],
          confidence: Math.min(1, Math.max(0, confidence)),
        };
      }),
      strengths: ["Clear submission structure.", "Deliverable matches the brief."],
      priorityImprovements: ["Deepen evidence for the lowest-scoring criterion."],
      confidence: Math.min(1, Math.max(0, confidence)),
    };
  }
}

/**
 * Future real provider (OpenAI-compatible chat completions with strict JSON).
 * Implemented when AI_API_KEY is provisioned; the pipeline already speaks
 * only the ReviewProvider interface, so swapping is configuration, not surgery.
 */
export interface ApiProviderConfig {
  baseUrl: string;
  apiKey: string;
  models: Record<ReviewModelProfile, string>;
}
