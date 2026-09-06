import { reviewerOutputSchema, type ReviewerOutput } from "./review-schema";
import type { BlindRubricCriterion, ReviewSource } from "./reviewer-input";

/**
 * Review validator (PRD §26): primary reviewer output is checked BEFORE it
 * can become a persisted review. Pure module — safe for offline tests.
 *
 * Checks: schema-valid JSON, every rubric criterion covered exactly once, no
 * unknown criterion ids, score ranges, at least one observed evidence string
 * per criterion, confidence ranges.
 */

export interface ValidationSuccess {
  ok: true;
  output: ReviewerOutput;
  warnings: string[];
}

export interface ValidationFailure {
  ok: false;
  errors: string[];
}

export function validateReviewerOutput(
  input: unknown,
  rubric: BlindRubricCriterion[],
  sources?: ReviewSource[],
): ValidationSuccess | ValidationFailure {
  const parsed = reviewerOutputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  }
  const errors: string[] = [];
  const warnings: string[] = [];
  const output = parsed.data;
  const knownIds = new Set(rubric.map((c) => c.id));
  const seenIds = new Set<string>();

  for (const criterion of output.criteria) {
    if (!knownIds.has(criterion.criterionId)) {
      // Hallucinated evidence anchor: the model scored something ungradeable.
      errors.push(`unknown criterion id: ${criterion.criterionId}`);
      continue;
    }
    if (seenIds.has(criterion.criterionId)) {
      errors.push(`duplicate criterion id: ${criterion.criterionId}`);
    }
    seenIds.add(criterion.criterionId);
    const rubricCriterion = rubric.find((c) => c.id === criterion.criterionId)!;
    if (criterion.score > rubricCriterion.maxScore) {
      errors.push(`score ${criterion.score} exceeds max ${rubricCriterion.maxScore} for ${rubricCriterion.name}`);
    }
    if (criterion.evidence.length === 0) {
      errors.push(`missing evidence for ${rubricCriterion.name}`);
    }
    if (sources) {
      for (const evidence of criterion.evidence) {
        const match = /^\[([^\]]+)\]\s+([\s\S]+)$/.exec(evidence);
        const source = sources.find((entry) => entry.id === match?.[1]);
        const quote = match?.[2]?.trim();
        if (!source || !quote || quote.length < 12 || !source.text.includes(quote)) {
          errors.push(`unverifiable evidence for ${rubricCriterion.name}`);
        }
      }
    }
    if (criterion.confidence < 0.5) {
      warnings.push(`low criterion confidence (${criterion.confidence}) for ${rubricCriterion.name}`);
    }
  }
  for (const criterion of rubric) {
    if (!seenIds.has(criterion.id)) errors.push(`missing criterion: ${criterion.name}`);
  }
  if (output.confidence < 0.5) warnings.push(`low overall confidence (${output.confidence})`);

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, output, warnings };
}
