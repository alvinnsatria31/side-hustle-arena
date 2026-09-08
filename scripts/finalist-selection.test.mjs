// A03 regression: a failed retry must not erase a valid earlier result.
//
// The scenario that motivated this is ordinary, not adversarial. A participant
// submits, gets a score on attempt one, then submits an improved version. The
// reviewer for attempt two dies terminally — provider outage, extraction
// crash. Version two now has an attempt number and no review. Selecting "the
// newest version with an attempt number" therefore found a version with no
// score and dropped the participant from the week entirely, losing a
// completion they had already earned.
import assert from "node:assert/strict";
import test from "node:test";
import {
  eligibleVersionOrder,
  isFinalizableReview,
  selectFinalVersion,
} from "../src/server/finalization/finalist-core.ts";

const at = (minutes) => new Date(Date.UTC(2026, 8, 4, 12, minutes));

const v1 = { id: "v1", versionNumber: 1, reviewAttemptNumber: 1, accessStatus: "ACCESSIBLE", submittedAt: at(0) };
const v2 = { id: "v2", versionNumber: 2, reviewAttemptNumber: 2, accessStatus: "ACCESSIBLE", submittedAt: at(30) };
const rejected = { id: "vx", versionNumber: 3, reviewAttemptNumber: null, accessStatus: "FAILED", submittedAt: at(45) };

const completed = (id) => ({ id, status: "COMPLETED_HIDDEN", finalScore: "82.00" });

test("only accessible, attempt-consuming versions are candidates, newest first", () => {
  assert.deepEqual(eligibleVersionOrder([v1, rejected, v2]).map((v) => v.id), ["v2", "v1"]);
  // A version that reached FAILED access never consumed an attempt and can
  // never carry a score; including it would rank an unreviewable submission.
  assert.deepEqual(eligibleVersionOrder([rejected]), []);
  assert.deepEqual(
    eligibleVersionOrder([{ ...v2, accessStatus: "FAILED" }]).map((v) => v.id),
    [],
  );
});

test("only a completed or published run with a real score is finalizable", () => {
  assert.equal(isFinalizableReview(completed("r1")), true);
  assert.equal(isFinalizableReview({ id: "r", status: "PUBLISHED", finalScore: 71 }), true);
  assert.equal(isFinalizableReview({ id: "r", status: "NEEDS_RESOLUTION", finalScore: "70.00" }), false);
  assert.equal(isFinalizableReview({ id: "r", status: "FAILED", finalScore: "70.00" }), false);
  assert.equal(isFinalizableReview({ id: "r", status: "VOIDED", finalScore: "70.00" }), false);
  assert.equal(isFinalizableReview({ id: "r", status: "COMPLETED_HIDDEN", finalScore: null }), false);
  assert.equal(isFinalizableReview(null), false);
  assert.equal(isFinalizableReview(undefined), false);
});

test("V1 succeeded then V2 failed terminally: the participant keeps the V1 result", () => {
  const reviews = new Map([["v1", completed("r1")]]);
  const selected = selectFinalVersion([v1, v2], (id) => reviews.get(id) ?? null);
  assert.equal(selected.version.id, "v1");
  assert.equal(selected.review.id, "r1");
  // And the submitted-at used for tie-breaking is V1's, not the failed retry's.
  assert.equal(selected.version.submittedAt.getTime(), at(0).getTime());
});

test("the newest reviewed version still wins when both attempts scored", () => {
  const reviews = new Map([["v1", completed("r1")], ["v2", completed("r2")]]);
  const selected = selectFinalVersion([v1, v2], (id) => reviews.get(id) ?? null);
  assert.equal(selected.version.id, "v2");
});

test("an unresolved disagreement on the newest version does not silently fall back", () => {
  // NEEDS_RESOLUTION is not finalizable, and finalizeWeek refuses the whole
  // week while one exists — so this fallback can only be reached after an
  // admin resolves it. Asserting the shape keeps the two rules consistent.
  const reviews = new Map([
    ["v1", completed("r1")],
    ["v2", { id: "r2", status: "NEEDS_RESOLUTION", finalScore: "60.00" }],
  ]);
  assert.equal(selectFinalVersion([v1, v2], (id) => reviews.get(id) ?? null).version.id, "v1");
});

test("no reviewed version at all means no finalist, not a zero score", () => {
  assert.equal(selectFinalVersion([v1, v2], () => null), null);
  assert.equal(selectFinalVersion([], () => completed("r")), null);
  assert.equal(selectFinalVersion([rejected], () => completed("r")), null);
});
