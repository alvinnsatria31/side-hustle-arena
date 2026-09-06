import assert from "node:assert/strict";
import test from "node:test";
import { scheduledWeekNotices } from "../src/server/notifications/schedule.ts";

test("open weeks announce projects and add one reminder in their final 24 hours", () => {
  const week = { id: "w", weekCode: "W1", status: "OPEN", opensAt: new Date("2026-09-07T01:00:00Z"), submissionDeadlineAt: new Date("2026-09-11T17:00:00Z") };
  assert.deepEqual(scheduledWeekNotices(week, new Date("2026-09-07T00:59:59Z")), []);
  assert.deepEqual(scheduledWeekNotices(week, week.opensAt).map((n) => n.type), ["PROJECT_DROP"]);
  const due = scheduledWeekNotices(week, new Date("2026-09-10T17:00:00Z"));
  assert.deepEqual(due.map((n) => n.type), ["PROJECT_DROP", "DEADLINE_REMINDER"]);
  assert.equal(due[1].actionUrl, "/app/arena");
  assert.deepEqual(scheduledWeekNotices(week, week.submissionDeadlineAt), []);
  assert.deepEqual(scheduledWeekNotices({ ...week, status: "DRAFT" }, week.opensAt), []);
});
