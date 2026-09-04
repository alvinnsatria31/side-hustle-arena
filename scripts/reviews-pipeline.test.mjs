import assert from "node:assert/strict";
import test from "node:test";

const schema = await import("../src/server/reviews/review-schema.ts");
const input = await import("../src/server/reviews/reviewer-input.ts");
const validator = await import("../src/server/reviews/validator.ts");
const scorer = await import("../src/server/reviews/scorer.ts");
const router = await import("../src/server/reviews/judge-router.ts");
const models = await import("../src/server/reviews/model-router.ts");
const internalAuth = await import("../src/server/reviews/internal-auth.ts");

const CRITERION_A = "0d224c11-a09f-41dd-8c7c-63484e7f7a0b";
const CRITERION_B = "1e335d22-b1a0-4ecc-8d8d-74595f8b1c2d";

const rubric = [
  { id: CRITERION_A, name: "Execution", description: null, weight: 3, maxScore: 100, reviewInstruction: null },
  { id: CRITERION_B, name: "Communication", description: null, weight: 1, maxScore: 100, reviewInstruction: null },
];

function goodOutput() {
  return {
    criteria: [
      { criterionId: CRITERION_A, score: 80, evidence: ["Clear deliverable"], issues: [], confidence: 0.9 },
      { criterionId: CRITERION_B, score: 60, evidence: ["Brief write-up"], issues: ["Thin rationale"], confidence: 0.75 },
    ],
    strengths: ["Solid execution"],
    priorityImprovements: ["Deepen rationale"],
    confidence: 0.85,
  };
}

test("validator accepts a complete evidence-backed review", () => {
  const result = validator.validateReviewerOutput(goodOutput(), rubric);
  assert.equal(result.ok, true);
  assert.deepEqual(result.warnings, []);
});

test("validator rejects unknown criteria, duplicates, gaps, and missing evidence", () => {
  const unknown = goodOutput();
  unknown.criteria[0].criterionId = "2f446e33-c2b1-4fdd-9e9e-85606f9c2d3e";
  assert.equal(validator.validateReviewerOutput(unknown, rubric).ok, false);

  const duplicate = goodOutput();
  duplicate.criteria[1].criterionId = CRITERION_A;
  const dupResult = validator.validateReviewerOutput(duplicate, rubric);
  assert.equal(dupResult.ok, false);

  const gap = goodOutput();
  gap.criteria = gap.criteria.slice(0, 1);
  assert.equal(validator.validateReviewerOutput(gap, rubric).ok, false);

  const noEvidence = goodOutput();
  noEvidence.criteria[0].evidence = [];
  assert.equal(validator.validateReviewerOutput(noEvidence, rubric).ok, false);

  const overMax = goodOutput();
  overMax.criteria[0].score = 150;
  assert.equal(validator.validateReviewerOutput(overMax, rubric).ok, false);
});

test("validator warns on low confidence but still accepts", () => {
  const output = goodOutput();
  output.criteria[0].confidence = 0.3;
  const result = validator.validateReviewerOutput(output, rubric);
  assert.equal(result.ok, true);
  assert.equal(result.warnings.length, 1);
});

test("scorer computes backend-weighted arithmetic, never trusting model totals", () => {
  // (80 * 3 + 60 * 1) / 4 = 75
  const { aiScore, rows } = scorer.computeWeightedScore(goodOutput().criteria, rubric);
  assert.equal(aiScore, 75);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].weightedScore, 60);
  assert.equal(rows[1].weightedScore, 15);
  assert.throws(() => scorer.computeWeightedScore(goodOutput().criteria, []), /positive/);
});

test("second-judge disagreement uses the 12-point threshold", () => {
  assert.equal(scorer.secondJudgeDisagrees(80, 91), false);
  assert.equal(scorer.secondJudgeDisagrees(80, 92), true);
  assert.equal(scorer.secondJudgeDisagrees(70, 58), true);
});

test("judge router only escalates shaky primaries", () => {
  assert.deepEqual(router.needsSecondJudge({ confidence: 0.9, warningCount: 0, hasUnextractedFiles: false }), { needed: false, reason: null });
  const low = router.needsSecondJudge({ confidence: 0.5, warningCount: 0, hasUnextractedFiles: false });
  assert.equal(low.needed, true);
  const warnings = router.needsSecondJudge({ confidence: 0.9, warningCount: 2, hasUnextractedFiles: false });
  assert.equal(warnings.needed, true);
  const files = router.needsSecondJudge({ confidence: 0.9, warningCount: 0, hasUnextractedFiles: true });
  assert.equal(files.needed, true);
  assert.equal(router.REVIEW_CONFIDENCE_MIN, 0.7);
});

test("blind input carries no previous scores, attempts history, or feedback", () => {
  const blind = input.buildBlindReviewerInput({
    attemptNumber: 3,
    projectTitle: "X",
    divisionName: "Y",
    rubric,
    explanation: "work",
    notes: null,
    items: [],
  });
  const serialized = JSON.stringify(blind);
  assert.equal(blind.attemptNumber, 3);
  assert.match(serialized, /work/);
  assert.doesNotMatch(serialized, /previous|history|feedback|final_score/i);
});

test("improvement feedback compares post-lock scores only", () => {
  const feedback = input.buildImprovementFeedback({
    current: [
      { criterionId: CRITERION_A, criterionName: "Execution", score: 85 },
      { criterionId: CRITERION_B, criterionName: "Communication", score: 55 },
    ],
    previous: [
      { criterionId: CRITERION_A, criterionName: "Execution", score: 70 },
      { criterionId: CRITERION_B, criterionName: "Communication", score: 58 },
    ],
  });
  assert.deepEqual(feedback.improved, ["Execution (+15 pts)"]);
  assert.deepEqual(feedback.stillNeedsWork, ["Communication", "Execution"]);
});

test("internal worker auth is fail-closed and timing-safe", () => {
  const saved = process.env.INTERNAL_AUTOMATION_TOKEN;
  try {
    delete process.env.INTERNAL_AUTOMATION_TOKEN;
    assert.throws(
      () => internalAuth.requireAutomationWorker(new Request("http://x/", { headers: { authorization: "Bearer anything" } })),
      (error) => error?.code === "FORBIDDEN",
    );
    process.env.INTERNAL_AUTOMATION_TOKEN = "test-token-123";
    assert.throws(
      () => internalAuth.requireAutomationWorker(new Request("http://x/")),
      (error) => error?.code === "FORBIDDEN",
    );
    assert.throws(
      () => internalAuth.requireAutomationWorker(new Request("http://x/", { headers: { authorization: "Bearer wrong" } })),
      (error) => error?.code === "FORBIDDEN",
    );
    assert.deepEqual(
      internalAuth.requireAutomationWorker(new Request("http://x/", { headers: { authorization: "Bearer test-token-123" } })),
      { workerId: "internal-automation" },
    );
  } finally {
    if (saved === undefined) delete process.env.INTERNAL_AUTOMATION_TOKEN;
    else process.env.INTERNAL_AUTOMATION_TOKEN = saved;
  }
});

test("stub provider is deterministic, labeled, and evidence-backed", async () => {
  const stub = new models.StubReviewProvider();
  assert.equal(stub.name, "stub-dev-v1");
  assert.equal(models.PROMPT_VERSION, "arena-reviewer-v1");
  const call = {
    profile: "review",
    model: stub.name,
    input: input.buildBlindReviewerInput({
      attemptNumber: 1, projectTitle: "X", divisionName: "Y", rubric,
      explanation: "work", notes: null, items: [],
    }),
  };
  const first = await stub.review(call);
  const second = await stub.review(call);
  assert.deepEqual(first, second);
  assert.ok(first.criteria.every((criterion) => criterion.evidence.length > 0));
  const low = new models.StubReviewProvider({ confidence: 0.4 });
  assert.equal((await low.review(call)).confidence, 0.4);
  const parsed = schema.reviewerOutputSchema.safeParse(first);
  assert.equal(parsed.success, true);
});
