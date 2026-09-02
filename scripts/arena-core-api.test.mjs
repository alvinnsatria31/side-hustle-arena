import assert from "node:assert/strict";
import test from "node:test";

const errors = await import("../src/server/arena/errors.ts");
const schemas = await import("../src/server/arena/schemas.ts");
const weeks = await import("../src/server/arena/week-service.ts");

test("Arena domain errors map validation, authorization, and conflicts to normalized safe responses", () => {
  const error = new errors.ArenaDomainError("ALREADY_ENROLLED_THIS_WEEK", "A project is already selected for this week.", {
    enrollmentId: "0d224c11-a09f-41dd-8c7c-63484e7f7a0b",
  });

  assert.deepEqual(errors.toArenaErrorResponse(error), {
    status: 409,
    body: {
      error: {
        code: "ALREADY_ENROLLED_THIS_WEEK",
        message: "A project is already selected for this week.",
        details: { enrollmentId: "0d224c11-a09f-41dd-8c7c-63484e7f7a0b" },
      },
    },
  });
  assert.equal(errors.toArenaErrorResponse(new errors.ArenaDomainError("FORBIDDEN", "Forbidden.")).status, 403);
  assert.equal(errors.toArenaErrorResponse(new errors.ArenaDomainError("VALIDATION_ERROR", "Invalid request.")).status, 400);
});

test("selection and workspace schemas reject client identity fields and oversized persisted content", () => {
  const projectId = "0d224c11-a09f-41dd-8c7c-63484e7f7a0b";
  assert.deepEqual(schemas.projectSelectionSchema.parse({ projectId }), { projectId });
  assert.equal(schemas.projectSelectionSchema.safeParse({ projectId, userId: "attacker" }).success, false);
  assert.equal(schemas.projectSelectionSchema.safeParse({ projectId: "not-a-uuid" }).success, false);

  assert.deepEqual(schemas.workspacePatchSchema.parse({
    currentStep: "PLAN",
    planText: "Validate the brief before implementation.",
    tools: ["Figma", "Google Sheets"],
    taskBreakdown: [{ title: "Review requirements", done: false }],
    notes: "Keep the scope focused.",
    reviewChecklist: [{ label: "Check the deliverable", done: false }],
  }).currentStep, "PLAN");
  assert.equal(schemas.workspacePatchSchema.safeParse({ planText: "x".repeat(20_001) }).success, false);
  assert.equal(schemas.workspacePatchSchema.safeParse({ tools: Array.from({ length: 51 }, () => "tool") }).success, false);
  assert.equal(schemas.workspacePatchSchema.safeParse({ taskBreakdown: [{ title: "x".repeat(501), done: false }] }).success, false);
});

test("current week selection uses persisted status priority and does not auto-transition lifecycle state", () => {
  const now = new Date("2026-09-03T10:00:00.000Z");
  const current = weeks.resolveCurrentWeekFromCandidates([
    { id: "scheduled", status: "SCHEDULED", opensAt: new Date("2026-09-07T00:00:00.000Z"), submissionDeadlineAt: new Date("2026-09-11T16:59:00.000Z") },
    { id: "closed", status: "CLOSED", opensAt: new Date("2026-08-24T00:00:00.000Z"), submissionDeadlineAt: new Date("2026-08-28T16:59:00.000Z"), closedAt: new Date("2026-08-28T17:00:00.000Z") },
    { id: "open", status: "OPEN", opensAt: new Date("2026-08-31T00:00:00.000Z"), submissionDeadlineAt: new Date("2026-09-04T16:59:00.000Z") },
  ], now);

  assert.equal(current?.id, "open");
  assert.equal(weeks.getWeekSelectionState(current, now).canSelect, true);

  const atDeadline = new Date("2026-09-04T16:59:00.000Z");
  assert.deepEqual(weeks.getWeekSelectionState(current, atDeadline), { canSelect: false, reason: "SELECTION_DEADLINE_PASSED" });
  assert.equal(current?.status, "OPEN", "the read model must not mutate persisted lifecycle status");
});

test("current week fallback is deterministic when no open week exists", () => {
  const now = new Date("2026-09-03T10:00:00.000Z");
  const scheduled = weeks.resolveCurrentWeekFromCandidates([
    { id: "later", status: "SCHEDULED", opensAt: new Date("2026-09-14T00:00:00.000Z"), submissionDeadlineAt: new Date("2026-09-18T16:59:00.000Z") },
    { id: "next", status: "SCHEDULED", opensAt: new Date("2026-09-07T00:00:00.000Z"), submissionDeadlineAt: new Date("2026-09-11T16:59:00.000Z") },
    { id: "recent-closed", status: "CLOSED", opensAt: new Date("2026-08-24T00:00:00.000Z"), submissionDeadlineAt: new Date("2026-08-28T16:59:00.000Z"), closedAt: new Date("2026-08-28T17:00:00.000Z") },
  ], now);
  assert.equal(scheduled?.id, "next");

  const closed = weeks.resolveCurrentWeekFromCandidates([
    { id: "older", status: "FINALIZED", opensAt: new Date("2026-08-10T00:00:00.000Z"), submissionDeadlineAt: new Date("2026-08-14T16:59:00.000Z"), finalizedAt: new Date("2026-08-15T00:00:00.000Z") },
    { id: "recent", status: "CLOSED", opensAt: new Date("2026-08-24T00:00:00.000Z"), submissionDeadlineAt: new Date("2026-08-28T16:59:00.000Z"), closedAt: new Date("2026-08-28T17:00:00.000Z") },
  ], now);
  assert.equal(closed?.id, "recent");
});
