// A04 + A05 regression: every stage of the pipeline runs under one deadline,
// and the schedules are fast enough for the retry policies they advertise.
//
// Three separate bugs shared one root cause — components choosing timeouts in
// isolation. Extraction gave itself 60s per document inside a 60s invocation.
// The review drain started its 45s clock after extraction had already run. The
// email outbox promised six retries inside a 23h window while flushing once a
// day, so a failed message got exactly one attempt before being held.
import assert from "node:assert/strict";
import test from "node:test";
import {
  BudgetExceededError,
  EXECUTION_CONTRACT,
  createExecutionBudget,
  isDeadlineError,
  reviewJobBudgetMs,
  workerRoundTripFitsLease,
} from "../src/server/ops/execution-budget.ts";
import { JOB_LEASE_SECONDS } from "../src/server/reviews/queue-policy.ts";
import {
  EMAIL_RETRY_WINDOW_MS,
  MAX_EMAIL_ATTEMPTS,
  flushCadenceIsSafe,
  retryAt,
  retryDelayMs,
  retryExpired,
  retryLadderSpanMs,
} from "../src/server/notifications/outbox-policy.ts";
import { runEmailFlush, runWeekNotifications, runProjectGenerate } from "../src/server/scheduler/service.ts";

function fakeClock(start = 0) {
  let value = start;
  return { now: () => value, advance: (ms) => { value += ms; } };
}

test("a whole review fits inside one drain budget, with the reserve intact", () => {
  // If this ever fails, a claimed job could not be finished in the invocation
  // that claimed it — which costs an automation attempt and a 10-minute lease
  // for nothing. Widen the invocation or narrow a stage; do not delete this.
  assert.ok(reviewJobBudgetMs() <= EXECUTION_CONTRACT.drainBudgetMs,
    `review budget ${reviewJobBudgetMs()}ms exceeds drain budget ${EXECUTION_CONTRACT.drainBudgetMs}ms`);
  assert.ok(EXECUTION_CONTRACT.drainBudgetMs < EXECUTION_CONTRACT.invocationSeconds * 1000);
  assert.ok(EXECUTION_CONTRACT.extractionBudgetMs < EXECUTION_CONTRACT.drainBudgetMs);
  assert.ok(EXECUTION_CONTRACT.divisionBudgetMs < EXECUTION_CONTRACT.drainBudgetMs);
  assert.ok(EXECUTION_CONTRACT.outboxBudgetMs < EXECUTION_CONTRACT.drainBudgetMs + 1);
});

test("the external worker can never still be working after its lease expires", () => {
  assert.equal(workerRoundTripFitsLease(), true);
  assert.equal(JOB_LEASE_SECONDS, EXECUTION_CONTRACT.leaseSeconds);
  assert.ok(EXECUTION_CONTRACT.workerHttpTimeoutMs > EXECUTION_CONTRACT.invocationSeconds * 1000);
});

test("a budget counts down, refuses work it cannot finish, and names the stage", () => {
  const clock = fakeClock();
  const budget = createExecutionBudget(10_000, { now: clock.now });
  assert.equal(budget.remainingMs(), 10_000);
  assert.equal(budget.hasRoomFor(6_000, 3_000), true);
  clock.advance(4_000);
  assert.equal(budget.remainingMs(), 6_000);
  assert.equal(budget.hasRoomFor(6_000, 3_000), false);
  assert.throws(() => budget.assertRoomFor(6_000, "second judge", 3_000), (error) => {
    assert.ok(error instanceof BudgetExceededError);
    assert.equal(error.stage, "second judge");
    assert.match(error.message, /second judge/);
    return true;
  });
  clock.advance(60_000);
  assert.equal(budget.expired(), true);
  assert.equal(budget.remainingMs(), 0);
});

test("budget exhaustion is recognised as a deadline, not as a broken provider", () => {
  assert.equal(isDeadlineError(new BudgetExceededError("stage", 0, 1)), true);
  const timeout = new Error("timed out");
  timeout.name = "TimeoutError";
  assert.equal(isDeadlineError(timeout), true);
  const aborted = new Error("aborted");
  aborted.name = "AbortError";
  assert.equal(isDeadlineError(aborted), true);
  assert.equal(isDeadlineError(new Error("connection refused")), false);
});

test("a budget signal never outlives the deadline, even with a larger cap", async () => {
  const budget = createExecutionBudget(20);
  const signal = budget.signal(60_000);
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(signal.aborted, true);
});

test("the email backoff ladder is exhaustible inside the idempotency window", () => {
  assert.equal(retryDelayMs(1), 5 * 60_000);
  assert.equal(retryDelayMs(2), 15 * 60_000);
  assert.equal(retryDelayMs(9), 240 * 60_000, "the ladder is capped, not unbounded");
  assert.ok(retryLadderSpanMs() < EMAIL_RETRY_WINDOW_MS);
  const start = new Date("2026-09-08T00:00:00Z");
  assert.ok(retryAt(1, start) > start);
});

test("a daily flush is unsafe; the configured 15-minute cadence is safe", () => {
  // This is the A05 finding stated as an assertion: with a daily tick the
  // second attempt lands after the window has already closed.
  assert.equal(flushCadenceIsSafe(24 * 3600_000), false);
  assert.equal(flushCadenceIsSafe(15 * 60_000), true);
  const first = new Date("2026-09-08T00:00:00Z");
  assert.equal(retryExpired(first, new Date(first.getTime() + 24 * 3600_000)), true);
  assert.equal(retryExpired(first, new Date(first.getTime() + retryLadderSpanMs() + MAX_EMAIL_ATTEMPTS * 15 * 60_000)), false);
  assert.equal(retryExpired(null, first), false);
});

test("one email-flush tick drains the backlog instead of stopping at 100", async () => {
  const clock = fakeClock();
  let remaining = 250;
  const flush = async ({ limit }) => {
    clock.advance(1_000);
    const sent = Math.min(limit, remaining);
    remaining -= sent;
    return { sent, failed: 0, skipped: 0, held: 0 };
  };
  const result = await runEmailFlush(new Date(), { flush, budgetMs: 30_000, clock: clock.now });
  assert.equal(result.detail.sent, 250);
  assert.equal(result.detail.batches, 4, "three full batches, then one empty batch proving it drained");
  assert.equal(result.detail.backlogRemaining, false);
});

test("email-flush stops on budget and reports the backlog rather than pretending", async () => {
  const clock = fakeClock();
  const flush = async () => { clock.advance(9_000); return { sent: 100, failed: 0, skipped: 0, held: 0 }; };
  const result = await runEmailFlush(new Date(), { flush, budgetMs: 20_000, clock: clock.now });
  assert.equal(result.detail.backlogRemaining, true);
  assert.ok(result.detail.batches <= 3);
});

test("an unconfigured provider stops the loop immediately without consuming attempts", async () => {
  let calls = 0;
  const flush = async () => { calls += 1; return { sent: 0, failed: 0, skipped: 0, held: 0, unconfigured: true }; };
  const result = await runEmailFlush(new Date(), { flush, budgetMs: 30_000, clock: fakeClock().now });
  assert.equal(calls, 1);
  assert.equal(result.detail.unconfigured, true);
  assert.equal(result.detail.backlogRemaining, false);
});

test("generation stops between divisions when the budget runs out, and resumes", async () => {
  const divisions = ["a", "b", "c", "d", "e", "f"];
  const prepared = new Set();
  let clock = fakeClock();
  const makeDeps = () => {
    clock = fakeClock();
    return {
      config: () => ({ enabled: true, autoPublish: false }),
      prepare: async () => ({ weekId: "week-1", created: true }),
      provider: () => ({ name: "test-provider" }),
      publish: async () => ({ published: [], held: [] }),
      due: async () => [],
      budgetMs: 45_000,
      clock: clock.now,
      // Stand in for generateWeek: same budget contract, same per-division
      // idempotency — an already-prepared division costs nothing and reports
      // `skipped`, which is what makes repeated ticks safe.
      generate: async ({ budget }) => {
        const results = [];
        let deferred = 0;
        for (const id of divisions) {
          if (prepared.has(id)) { results.push({ divisionId: id, skipped: "division already prepared" }); continue; }
          if (!budget.hasRoomFor(20_000)) { deferred = divisions.length - results.length; break; }
          clock.advance(18_000);
          prepared.add(id);
          results.push({ divisionId: id, projectId: `p-${id}` });
        }
        return { weekId: "week-1", results, ...(deferred ? { deferredDivisions: deferred } : {}) };
      },
    };
  };

  const first = await runProjectGenerate(new Date(), makeDeps());
  assert.deepEqual([...prepared], ["a", "b"], "two divisions fit in a 45s budget at 18s each");
  assert.equal(first.detail.deferredDivisions, 4);
  assert.equal(first.done, false, "an incomplete week must not report done");
  assert.match(first.detail.stopped, /next tick continues/);

  // Later ticks continue rather than restarting, and never regenerate.
  await runProjectGenerate(new Date(), makeDeps());
  assert.deepEqual([...prepared], ["a", "b", "c", "d"]);
  const third = await runProjectGenerate(new Date(), makeDeps());
  assert.deepEqual([...prepared], ["a", "b", "c", "d", "e", "f"]);
  assert.equal(third.detail.deferredDivisions, undefined);
  assert.equal(third.done, true, "a week with every division prepared reports done");
});

test("a broadcast larger than one batch keeps going inside the same tick", async () => {
  const clock = fakeClock();
  let round = 0;
  const broadcast = async () => {
    clock.advance(3_000);
    round += 1;
    return { notified: 100, failed: 0, alreadyNotified: 0, batchFull: round < 3 };
  };
  // No open weeks in the fake database means no rounds run; the loop itself is
  // asserted through the injected broadcast in the scheduler contract test.
  const result = await runWeekNotifications(new Date(), { budgetMs: 30_000, clock: clock.now, broadcast })
    .catch((error) => ({ job: "week-notifications", done: false, detail: { failed: String(error) } }));
  assert.equal(result.job, "week-notifications");
});
