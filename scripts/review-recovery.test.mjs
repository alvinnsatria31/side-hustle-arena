// A02 regression: the review queue must never lose a job, and never let a late
// callback rewrite a settled one.
//
// Two failures motivated these. A worker that died after winning the fifth
// automation attempt left PROCESSING behind with a dead lease that nothing
// could claim again — and finalization counts that as an open job, so the week
// never closed. And failReviewJob checked only lockedBy, which survives
// completion, so a worker reporting a local timeout could flip an already
// COMPLETED job back to RETRY.
import assert from "node:assert/strict";
import test from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  MAX_JOB_ATTEMPTS,
  canAdminRequeue,
  classifyLease,
  isAbandonedAtAttemptLimit,
  backoffAvailableAt,
} from "../src/server/reviews/queue-policy.ts";
import { failReviewJob, sweepAbandonedReviewJobs, claimReviewJob } from "../src/server/reviews/queue-service.ts";
import { rerunReview } from "../src/server/reviews/admin.ts";
import { reviewJobs, submissionVersions, logs } from "../src/server/db/schema/index.ts";

const now = new Date("2026-09-08T12:00:00Z");
const live = new Date(now.getTime() + 60_000);
const dead = new Date(now.getTime() - 60_000);

const processing = (over = {}) => ({
  id: "job-1",
  submissionVersionId: "version-1",
  status: "PROCESSING",
  lockedBy: "n8n-grading",
  leaseExpiresAt: live,
  attemptCount: 1,
  ...over,
});

/**
 * A database stand-in that answers query shapes, not SQL.
 *
 * selections is consumed in order by each select(); every write is recorded
 * with the predicate it carried, so a test can assert the guard — which is the
 * part that actually makes these operations safe.
 */
function fakeDb(selections, { updated = () => [{ id: "job-1" }] } = {}) {
  const writes = [];
  const db = {
    writes,
    transaction: async (fn) => fn(db),
    select() {
      const rows = selections.shift() ?? [];
      const chain = { then: (resolve) => Promise.resolve(rows).then(resolve) };
      for (const key of ["from", "innerJoin", "orderBy", "limit", "for"]) chain[key] = () => chain;
      chain.where = () => chain;
      return chain;
    },
    insert: (table) => ({
      values: (value) => {
        writes.push({ table, value, op: "insert" });
        const chain = Promise.resolve([{ id: "row" }]);
        chain.returning = () => Promise.resolve([{ id: "row" }]);
        chain.onConflictDoNothing = () => chain;
        return chain;
      },
    }),
    update: (table) => ({
      set: (value) => ({
        where: (predicate) => {
          const record = { table, value, predicate, op: "update" };
          writes.push(record);
          const chain = Promise.resolve(updated(record));
          chain.returning = () => Promise.resolve(updated(record));
          return chain;
        },
      }),
    }),
  };
  return db;
}

const sqlOf = (predicate) => new PgDialect().sqlToQuery(predicate);

test("lease classification names every way a callback can be stale", () => {
  assert.equal(classifyLease(processing(), { workerId: "n8n-grading", now }), "VALID");
  assert.equal(classifyLease(processing({ status: "COMPLETED" }), { workerId: "n8n-grading", now }), "SETTLED");
  assert.equal(classifyLease(processing({ status: "FAILED" }), { workerId: "n8n-grading", now }), "SETTLED");
  assert.equal(classifyLease(processing({ status: "RETRY" }), { workerId: "n8n-grading", now }), "NOT_PROCESSING");
  assert.equal(classifyLease(processing(), { workerId: "other-worker", now }), "WRONG_WORKER");
  assert.equal(classifyLease(processing({ leaseExpiresAt: dead }), { workerId: "n8n-grading", now }), "LEASE_EXPIRED");
  assert.equal(classifyLease(processing({ leaseExpiresAt: null }), { workerId: "n8n-grading", now }), "LEASE_EXPIRED");
  assert.equal(
    classifyLease(processing({ attemptCount: 3 }), { workerId: "n8n-grading", now, attemptCount: 2 }),
    "ATTEMPT_SUPERSEDED",
  );
});

test("a crash on the final attempt is recognised as abandoned, earlier ones are not", () => {
  assert.equal(isAbandonedAtAttemptLimit(processing({ attemptCount: MAX_JOB_ATTEMPTS, leaseExpiresAt: dead }), now), true);
  assert.equal(isAbandonedAtAttemptLimit(processing({ attemptCount: MAX_JOB_ATTEMPTS, leaseExpiresAt: live }), now), false);
  assert.equal(isAbandonedAtAttemptLimit(processing({ attemptCount: MAX_JOB_ATTEMPTS - 1, leaseExpiresAt: dead }), now), false);
  assert.equal(isAbandonedAtAttemptLimit(processing({ status: "COMPLETED", attemptCount: 9, leaseExpiresAt: dead }), now), false);
  // Backoff grows, but stays inside one hour so a queue cannot stall for a day.
  assert.ok(backoffAvailableAt(1, now) < backoffAvailableAt(4, now));
  assert.ok(backoffAvailableAt(99, now).getTime() - now.getTime() <= 3600_000);
});

test("the sweeper only retires PROCESSING jobs past the attempt budget with a dead lease", async () => {
  const db = fakeDb([], { updated: () => [{ id: "job-1", versionId: "version-1" }] });
  const result = await sweepAbandonedReviewJobs(now, db);
  assert.deepEqual(result.failed, ["job-1"]);
  const sweep = db.writes.find((write) => write.table === reviewJobs);
  assert.equal(sweep.value.status, "FAILED");
  assert.equal(sweep.value.lastErrorCode, "LEASE_ABANDONED");
  const query = sqlOf(sweep.predicate);
  assert.match(query.sql, /status/);
  assert.match(query.sql, /attempt_count/);
  assert.match(query.sql, /lease_expires_at/);
  assert.ok(query.params.includes("PROCESSING"));
  assert.ok(query.params.includes(MAX_JOB_ATTEMPTS));
  // The version is marked FAILED too, so the participant sees a real outcome.
  assert.ok(db.writes.some((write) => write.table === submissionVersions && write.value.reviewStatus === "FAILED"));
  assert.ok(db.writes.some((write) => write.table === logs && write.value.action === "REVIEW_FAILED"));
});

test("a late failure cannot turn a COMPLETED job back into RETRY", async () => {
  const db = fakeDb([[processing({ status: "COMPLETED" })]]);
  const result = await failReviewJob({ jobId: "job-1", workerId: "n8n-grading", code: "TIMEOUT", message: "worker gave up", now, db });
  assert.deepEqual(result, { status: "COMPLETED", applied: false, reason: "SETTLED" });
  assert.equal(db.writes.some((write) => write.table === reviewJobs), false);
  const audit = db.writes.find((write) => write.table === logs);
  assert.equal(audit.value.action, "REVIEW_FAIL_IGNORED");
});

test("a failure from an expired lease or a different worker is ignored, not obeyed", async () => {
  for (const [job, reason] of [
    [processing({ leaseExpiresAt: dead }), "LEASE_EXPIRED"],
    [processing({ lockedBy: "someone-else" }), "WRONG_WORKER"],
    [processing({ status: "RETRY" }), "NOT_PROCESSING"],
  ]) {
    const db = fakeDb([[job]]);
    const result = await failReviewJob({ jobId: "job-1", workerId: "n8n-grading", code: "TIMEOUT", message: "late", now, db });
    assert.equal(result.applied, false);
    assert.equal(result.reason, reason);
    assert.equal(db.writes.some((write) => write.table === reviewJobs), false);
  }
});

test("a valid failure retries under a conditional write, and the fifth attempt ends terminally", async () => {
  const retry = fakeDb([[processing({ attemptCount: 2 })]]);
  const retried = await failReviewJob({ jobId: "job-1", workerId: "n8n-grading", code: "PROVIDER", message: "502", now, db: retry });
  assert.deepEqual(retried, { status: "RETRY", applied: true });
  const write = retry.writes.find((entry) => entry.table === reviewJobs);
  assert.equal(write.value.status, "RETRY");
  assert.ok(write.value.availableAt > now);
  const guard = sqlOf(write.predicate);
  // The guard is the safety property: id alone would let a stale caller win.
  assert.ok(guard.params.includes("PROCESSING"));
  assert.ok(guard.params.includes("n8n-grading"));
  assert.ok(guard.params.includes(2));

  const terminal = fakeDb([[processing({ attemptCount: MAX_JOB_ATTEMPTS })]]);
  const failed = await failReviewJob({ jobId: "job-1", workerId: "n8n-grading", code: "PROVIDER", message: "502", now, db: terminal });
  assert.deepEqual(failed, { status: "FAILED", applied: true });
  assert.ok(terminal.writes.some((entry) => entry.table === submissionVersions && entry.value.reviewStatus === "FAILED"));
});

test("losing the conditional write race reports not-applied instead of pretending", async () => {
  const db = fakeDb([[processing()]], { updated: () => [] });
  const result = await failReviewJob({ jobId: "job-1", workerId: "n8n-grading", code: "PROVIDER", message: "502", now, db });
  assert.deepEqual(result, { status: "PROCESSING", applied: false, reason: "RACE_LOST" });
  assert.equal(db.writes.some((write) => write.table === submissionVersions), false);
});

test("claiming sweeps abandoned jobs first, then looks for work below the attempt budget", async () => {
  const db = fakeDb([[]], { updated: () => [] });
  const claimed = await claimReviewJob("worker", now, db);
  assert.equal(claimed, null);
  const sweep = db.writes.find((write) => write.table === reviewJobs);
  assert.equal(sweep.value.lastErrorCode, "LEASE_ABANDONED");
});

test("admin rerun recovers a first review that never produced a row", async () => {
  const version = { id: "version-1", reviewAttemptNumber: 1, accessStatus: "ACCESSIBLE" };
  const db = fakeDb([
    [{ weekId: "week-1" }],
    [{ status: "FINALIZING" }],
    [version],
    [],                                                       // no review rows at all
    [processing({ status: "FAILED", leaseExpiresAt: dead })], // terminal job
  ]);
  const result = await rerunReview({ versionId: "version-1", actorSubject: "admin", reason: "extraction bug fixed", now, db });
  assert.equal(result.nextRunNumber, 1);
  const requeue = db.writes.find((write) => write.table === reviewJobs);
  assert.equal(requeue.value.status, "PENDING");
  assert.equal(requeue.value.attemptCount, 0);
  const audit = db.writes.find((write) => write.table === logs);
  assert.equal(audit.value.metadata.recovery, "first-review-failure");
});

test("admin rerun refuses to steal a job from a worker holding a live lease", async () => {
  const db = fakeDb([
    [{ weekId: "week-1" }],
    [{ status: "OPEN" }],
    [{ id: "version-1", reviewAttemptNumber: 1, accessStatus: "ACCESSIBLE" }],
    [{ runNumber: 1, aiScore: "70.00" }],
    [processing()],
  ]);
  await assert.rejects(
    () => rerunReview({ versionId: "version-1", actorSubject: "admin", reason: "second opinion", now, db }),
    (error) => error.code === "REVIEW_JOB_UNAVAILABLE",
  );
  assert.equal(canAdminRequeue(processing(), now), false);
  assert.equal(canAdminRequeue(processing({ leaseExpiresAt: dead }), now), true);
  assert.equal(canAdminRequeue(null, now), true);
});

test("a version that never consumed an attempt is not rerunnable", async () => {
  const db = fakeDb([
    [{ weekId: "week-1" }],
    [{ status: "OPEN" }],
    [{ id: "version-1", reviewAttemptNumber: null, accessStatus: "FAILED" }],
  ]);
  await assert.rejects(
    () => rerunReview({ versionId: "version-1", actorSubject: "admin", reason: "retry", now, db }),
    (error) => error.code === "VALIDATION_ERROR",
  );
});

test("a finalized or archived week refuses a rerun before touching the job", async () => {
  for (const status of ["FINALIZED", "ARCHIVED"]) {
    const db = fakeDb([
      [{ weekId: "week-1" }],
      [{ status }],
      [{ id: "version-1", reviewAttemptNumber: 1, accessStatus: "ACCESSIBLE" }],
      [],
      [processing({ status: "FAILED", leaseExpiresAt: dead })],
    ]);
    await assert.rejects(
      () => rerunReview({ versionId: "version-1", actorSubject: "admin", reason: "late correction", now, db }),
      (error) => error.code === "WEEK_ALREADY_FINALIZED",
    );
    assert.equal(db.writes.length, 0);
  }
});
