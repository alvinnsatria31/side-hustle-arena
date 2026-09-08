import "server-only";
import { and, asc, eq, gt, inArray, lte } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { weeks } from "@/server/db/schema";
import { ArenaDomainError } from "@/server/arena/errors";
import { closeWeekForFinalization, finalizeWeek } from "@/server/finalization/service";
import { broadcastWeekNotification, flushPendingEmails } from "@/server/notifications/service";
import { scheduledWeekNotices } from "@/server/notifications/schedule";
import { cleanupExpiredArenaSessions } from "@/server/auth/session-retention";
import { pruneRateLimitCounters } from "@/server/cv/rate-limit";
import { cleanupExpiredUploads } from "@/server/storage/cleanup";
import { generateWeek, prepareScheduledWeek, publishWeek } from "@/server/generation/service";
import { createReviewProvider } from "@/server/reviews/model-router";
import { runConfiguredReviewJob } from "@/server/reviews/worker";
import { sweepAbandonedReviewJobs } from "@/server/reviews/queue-service";
import { generationConfig } from "@/server/generation/core";
import { createGenerationProvider } from "@/server/generation/ai-provider";
import { EXECUTION_CONTRACT, createExecutionBudget, isDeadlineError } from "@/server/ops/execution-budget";
import { hideOpeningsForInactiveSources, syncDueJobSources } from "@/server/career/jobs/sync-service";

const ACTOR = "scheduler";

/**
 * Scheduled jobs (PRD §65 "Finalization", §49 incident handling).
 *
 * Every job is idempotent and safe to run on a timer that fires more often than
 * needed: each one finds its own work, reports `skipped` when there is none,
 * and never forces past a guard. A job that cannot complete yet (reviews still
 * running, say) reports why and lets the next tick retry rather than failing
 * the run — the schedule is the retry mechanism.
 */
export type JobResult = { job: string; done: boolean; detail: Record<string, unknown> };

/** Move an OPEN week into FINALIZING once its deadline has genuinely passed. */
export async function runWeekClose(now = new Date()): Promise<JobResult> {
  const db = getDb();
  const due = await db
    .select({ id: weeks.id, weekCode: weeks.weekCode })
    .from(weeks)
    .where(and(eq(weeks.status, "OPEN"), lte(weeks.submissionDeadlineAt, now)))
    .orderBy(asc(weeks.submissionDeadlineAt));

  if (due.length === 0) return { job: "week-close", done: true, detail: { skipped: "no open week past its deadline" } };

  const closed: string[] = [];
  for (const week of due) {
    // Never forced: `force` is the audited admin emergency path, not a timer's.
    const result = await closeWeekForFinalization({ weekId: week.id, actorSubject: ACTOR, now });
    closed.push(`${week.weekCode}:${result.status}`);
  }
  return { job: "week-close", done: true, detail: { closed } };
}

/**
 * Finalize weeks sitting in FINALIZING. finalizeWeek refuses while reviews are
 * pending or a disagreement is unresolved, which is not a failure here — the
 * week simply is not ready, and a later tick will pick it up.
 */
export async function runWeekFinalize(now = new Date()): Promise<JobResult> {
  const db = getDb();
  // A job stranded past its attempt budget counts as "open" and would block
  // finalization forever. Retire those first so the week can proceed and the
  // affected version is visibly FAILED rather than silently pending.
  const swept = await sweepAbandonedReviewJobs(now, db);
  const pending = await db
    .select({ id: weeks.id, weekCode: weeks.weekCode })
    .from(weeks)
    .where(eq(weeks.status, "FINALIZING"))
    .orderBy(asc(weeks.submissionDeadlineAt));

  if (pending.length === 0) return { job: "week-finalize", done: true, detail: { skipped: "no week awaiting finalization", sweptJobs: swept.failed.length } };

  const finalized: string[] = [];
  const waiting: string[] = [];
  for (const week of pending) {
    try {
      const result = await finalizeWeek({ weekId: week.id, actorSubject: ACTOR, now });
      finalized.push(`${week.weekCode}:ranked=${result.ranked}:points=${result.pointsAwarded}`);
    } catch (error) {
      if (error instanceof ArenaDomainError && error.code === "WEEK_NOT_READY") {
        waiting.push(`${week.weekCode}:${error.message}`);
        continue;
      }
      throw error;
    }
  }
  return { job: "week-finalize", done: true, detail: { finalized, waiting, sweptJobs: swept.failed.length } };
}

/**
 * Drain queued EMAIL deliveries. No provider key configured leaves them PENDING.
 *
 * One batch is capped at 100 messages, which is not the same thing as "the
 * backlog is empty". A single announcement to more than 100 participants used
 * to need as many ticks as the schedule happened to provide, and the schedule
 * was daily — so a backlog could outlive the 23h idempotency window that
 * decides whether a failed message may be retried at all. The tick now keeps
 * draining while there is work and budget, and reports what it left behind.
 */
export async function runEmailFlush(_now = new Date(), deps = { flush: flushPendingEmails, budgetMs: EXECUTION_CONTRACT.outboxBudgetMs, clock: () => Date.now() }): Promise<JobResult> {
  const budget = createExecutionBudget(deps.budgetMs, { now: deps.clock });
  const totals = { sent: 0, failed: 0, skipped: 0, held: 0 };
  let batches = 0;
  let unconfigured = false;
  let drained = false;
  while (budget.hasRoomFor(2_000)) {
    const batch = await deps.flush({ limit: 100 });
    batches += 1;
    if (batch.unconfigured) { unconfigured = true; break; }
    for (const key of ["sent", "failed", "skipped", "held"] as const) totals[key] += batch[key] ?? 0;
    if ((batch.sent + batch.failed + batch.skipped + batch.held) === 0) { drained = true; break; }
  }
  return {
    job: "email-flush",
    done: true,
    detail: { ...totals, batches, ...(unconfigured ? { unconfigured: true } : {}), backlogRemaining: !unconfigured && !drained },
  };
}

/**
 * Recover missed broadcasts from durable week state; events dedupe across ticks.
 *
 * One broadcast batch covers at most 100 recipients, so a cohort larger than
 * that needs several rounds. Waiting for the next tick was fine when ticks were
 * frequent and wrong when they were daily — a deadline reminder that reaches
 * half a cohort a day late is not a reminder. Rounds now repeat inside the
 * invocation while a batch comes back full and the budget allows.
 */
export async function runWeekNotifications(now = new Date(), deps = { budgetMs: EXECUTION_CONTRACT.outboxBudgetMs, clock: () => Date.now(), broadcast: broadcastWeekNotification }): Promise<JobResult> {
  const budget = createExecutionBudget(deps.budgetMs, { now: deps.clock });
  const open = await getDb().select().from(weeks).where(and(eq(weeks.status, "OPEN"),
    lte(weeks.opensAt, now), gt(weeks.submissionDeadlineAt, now))).orderBy(asc(weeks.opensAt));
  const results = [];
  let incomplete = false;
  for (const week of open) {
    for (const notice of scheduledWeekNotices(week, now)) {
      let rounds = 0;
      for (;;) {
        if (!budget.hasRoomFor(2_000)) { incomplete = true; break; }
        try {
          const result = await deps.broadcast({ ...notice, now });
          rounds += 1;
          results.push({ weekId: week.id, type: notice.type, round: rounds, ...result });
          if (!result.batchFull) break;
        } catch (error) {
          if (!(error instanceof ArenaDomainError)) throw error;
          results.push({ weekId: week.id, type: notice.type, failed: 1, message: error.message });
          break;
        }
      }
    }
  }
  return {
    job: "week-notifications",
    done: !incomplete && results.every((result) => !result.failed && !("batchFull" in result && result.batchFull)),
    detail: { results, ...(incomplete ? { stopped: "time budget reached; the next tick continues" } : {}) },
  };
}

/**
 * Drop auth sessions past the retention window (PRD §65 Authentication), and
 * the spent rate-limit windows alongside them.
 *
 * Both are ephemeral rows that only exist to be forgotten, so they share one
 * daily sweep rather than growing a cron entry each. Pruning counters here also
 * keeps it off the CV scan request path, where it would make one unlucky
 * visitor pay for everyone else's housekeeping.
 */
export async function runSessionCleanup(now = new Date()): Promise<JobResult> {
  return {
    job: "session-cleanup",
    done: true,
    detail: {
      deleted: await cleanupExpiredArenaSessions(now),
      rateLimitWindows: await pruneRateLimitCounters(now),
    },
  };
}

const projectJobs = {
  config: generationConfig,
  prepare: prepareScheduledWeek,
  provider: createGenerationProvider,
  generate: generateWeek,
  publish: publishWeek,
  budgetMs: EXECUTION_CONTRACT.drainBudgetMs,
  clock: () => Date.now(),
  due: async (now: Date) => getDb().select({ id: weeks.id, weekCode: weeks.weekCode }).from(weeks)
    .where(and(inArray(weeks.status, ["DRAFT", "PREVIEW", "SCHEDULED"]),
      lte(weeks.opensAt, now), gt(weeks.submissionDeadlineAt, now)))
    .orderBy(asc(weeks.opensAt)),
};

/**
 * Prepare Sunday's preview. Publication is a separate, opening-time-gated job.
 *
 * Bounded by the invocation budget and safe to re-run: divisions already
 * prepared report `skipped`, so repeated ticks during the generation window
 * finish the week without ever regenerating what is already there.
 */
export async function runProjectGenerate(now = new Date(), deps = projectJobs): Promise<JobResult> {
  const job = "project-generate";
  if (!deps.config().enabled) return { job, done: false, detail: { skipped: "generation disabled" } };
  const actor = { actorSubject: ACTOR, actorType: "AUTOMATION" as const };
  const budget = createExecutionBudget(deps.budgetMs, { now: deps.clock });
  try {
    const prepared = await deps.prepare({ ...actor, now });
    if (!("weekId" in prepared)) {
      return { job, done: false, detail: { skipped: prepared.skipped } };
    }
    const provider = deps.provider() ?? undefined;
    const generated = await deps.generate({ ...actor, weekId: prepared.weekId, provider, now, budget });
    const deferred = "deferredDivisions" in generated ? generated.deferredDivisions ?? 0 : 0;
    return {
      job,
      done: deferred === 0 && generated.results.length > 0 && generated.results.every((result) => !("failed" in result)),
      detail: {
        weekId: prepared.weekId, created: prepared.created, provider: provider?.name ?? "library-only", results: generated.results,
        ...(deferred ? { deferredDivisions: deferred, stopped: "time budget reached; the next tick continues" } : {}),
      },
    };
  } catch (error) {
    if (error instanceof ArenaDomainError) {
      return { job, done: false, detail: { failed: error.code, message: error.message } };
    }
    if (isDeadlineError(error)) {
      return { job, done: false, detail: { stopped: "time budget reached; the next tick continues" } };
    }
    throw error;
  }
}

/** Retry due weeks until publication succeeds or their submission deadline passes. */
export async function runProjectDrop(now = new Date(), deps = projectJobs): Promise<JobResult> {
  const job = "project-drop";
  if (!deps.config().autoPublish) return { job, done: false, detail: { skipped: "auto-publish disabled; manual publication required" } };
  const due = await deps.due(now);
  if (!due.length) return { job, done: true, detail: { skipped: "no week due for publication" } };
  const results = [];
  let done = true;
  for (const week of due) {
    try {
      const result = await deps.publish({ actorSubject: ACTOR, actorType: "AUTOMATION", weekId: week.id, now });
      if ((!result.published.length && result.skipped !== "week already open") || result.held.length) done = false;
      results.push({ ...result, weekId: week.id });
    } catch (error) {
      if (!(error instanceof ArenaDomainError)) throw error;
      done = false;
      results.push({ weekId: week.id, failed: error.code, message: error.message });
    }
  }
  return { job, done, detail: { results } };
}

/** Delete expired, unreferenced upload intents past the grace period (live run, bounded). */
export async function runStorageCleanup(): Promise<JobResult> {
  const totals = await cleanupExpiredUploads({ dryRun: false, limit: 100 });
  return { job: "storage-cleanup", done: true, detail: { ...totals } };
}

/**
 * One drain tick is deliberately SMALL.
 *
 * A serverless invocation has a hard ceiling (60s on the free plan), and a tick
 * that overruns it is killed mid-review — leaving jobs leased to a worker that
 * no longer exists and waiting out the lease before anyone can retry them. So a
 * tick takes a few jobs, stops well inside the ceiling, and lets the next
 * trigger continue. Frequent small ticks, not one long drain.
 */
const REVIEW_DRAIN_MAX_JOBS = Number(process.env.ARENA_REVIEW_DRAIN_MAX_JOBS ?? 3);
const REVIEW_DRAIN_BUDGET_MS = Number(process.env.ARENA_REVIEW_DRAIN_BUDGET_MS ?? EXECUTION_CONTRACT.drainBudgetMs);

const reviewJobs = {
  provider: () => createReviewProvider("review"),
  runOne: runConfiguredReviewJob,
  maxJobs: REVIEW_DRAIN_MAX_JOBS,
  budgetMs: REVIEW_DRAIN_BUDGET_MS,
  clock: () => Date.now(),
};

/**
 * Review whatever is queued, using the configured AI provider (PRD §20, §43).
 *
 * This is the link that makes the pipeline run itself: without it a submission
 * reaches QUEUED and stops there until a human poked `/api/internal/reviews/run`
 * once per job. The scoring still happens inside Arena — the trigger only says
 * "now", it never carries a score.
 *
 * Unconfigured AI is reported as skipped, not as a failure: an environment
 * without model credentials should stay quiet rather than alarm every tick.
 * A provider that fails mid-batch stops the tick — `runConfiguredReviewJob` has
 * already handed that job back for retry, and hammering a broken provider would
 * just burn the automation attempts of every other job behind it.
 */
export async function runReviewsRun(_now = new Date(), deps = reviewJobs): Promise<JobResult> {
  const job = "reviews-run";
  try {
    deps.provider();
  } catch (error) {
    return { job, done: false, detail: { skipped: "AI review provider is not configured", reason: (error as Error).message } };
  }

  const deadline = deps.clock() + deps.budgetMs;
  const reviewed: Array<Record<string, unknown>> = [];
  let stopped: string | undefined;
  let failure: string | undefined;

  for (let attempt = 0; attempt < deps.maxJobs; attempt += 1) {
    const remainingMs = deadline - deps.clock();
    if (remainingMs <= 0) {
      stopped = "time budget reached; the next tick continues";
      break;
    }
    let completed: Awaited<ReturnType<typeof runConfiguredReviewJob>>;
    try {
      // The budget bounds the job itself, not just the decision to start one.
      // Checking only up front let a job claimed with 1ms of budget left run for
      // its own provider ceiling instead, overrunning the invocation.
      completed = await deps.runOne({ budgetMs: remainingMs });
    } catch (error) {
      if (isDeadlineError(error) && deps.clock() >= deadline) {
        // Out of budget, not broken. The job was handed back for retry, so the
        // next tick picks it up — reporting this as a failure would make an
        // ordinary busy tick look like a provider outage.
        stopped = "time budget reached mid-review; the job was handed back for retry";
        break;
      }
      failure = error instanceof Error ? error.message : String(error);
      break;
    }
    if (!completed) {
      stopped = "queue empty";
      break;
    }
    reviewed.push({ versionId: completed.versionId, status: completed.status, aiScore: completed.aiScore, secondJudge: completed.secondJudge.ran });
  }

  return {
    job,
    done: failure === undefined,
    detail: { reviewed: reviewed.length, results: reviewed, ...(stopped ? { stopped } : {}), ...(failure ? { failed: failure } : {}) },
  };
}

/**
 * Pull new openings from every connected jobs provider.
 *
 * Idempotent at three levels, because this is the job most likely to be
 * triggered twice: a per-source lease means two workers never page one feed at
 * once, the run row is keyed so a repeated trigger resumes rather than forks,
 * and the opening upsert is keyed on (source, external id) so re-reading a
 * page updates instead of duplicating.
 *
 * "No sources configured" is reported as skipped, not as a failure — an
 * environment with no provider connected should stay quiet rather than alarm
 * every tick.
 */
export async function runJobsSync(now = new Date(), deps = { sync: syncDueJobSources, hide: hideOpeningsForInactiveSources, budgetMs: EXECUTION_CONTRACT.drainBudgetMs, clock: () => Date.now() }): Promise<JobResult> {
  const job = "jobs-sync";
  const budget = createExecutionBudget(deps.budgetMs, { now: deps.clock });
  // A source switched off should stop being recommended promptly, without
  // claiming the roles it listed have all closed.
  const hidden = await deps.hide(undefined, now);
  const { synced, deferred } = await deps.sync({ triggeredBy: ACTOR, now, budget });
  if (!synced.length && !deferred) {
    return { job, done: true, detail: { skipped: "no active jobs source is due", hiddenFromDisabledSources: hidden } };
  }
  const failed = synced.filter((outcome) => outcome.status === "FAILED");
  return {
    job,
    done: failed.length === 0 && deferred === 0,
    detail: {
      hiddenFromDisabledSources: hidden,
      results: synced.map((outcome) => ({
        source: outcome.sourceSlug, status: outcome.status, ...outcome.totals,
        ...(outcome.errorCode ? { errorCode: outcome.errorCode } : {}),
        ...(outcome.skipped ? { skipped: outcome.skipped } : {}),
      })),
      ...(deferred ? { deferredSources: deferred, stopped: "time budget reached; the next tick continues" } : {}),
    },
  };
}

export const JOBS = {
  "week-close": runWeekClose,
  "week-finalize": runWeekFinalize,
  "email-flush": runEmailFlush,
  "week-notifications": runWeekNotifications,
  "session-cleanup": runSessionCleanup,
  "storage-cleanup": runStorageCleanup,
  "project-drop": runProjectDrop,
  "project-generate": runProjectGenerate,
  "reviews-run": runReviewsRun,
  "jobs-sync": runJobsSync,
} satisfies Record<string, (now?: Date) => Promise<JobResult>>;

export type JobName = keyof typeof JOBS;
