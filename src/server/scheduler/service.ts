import "server-only";
import { and, asc, eq, gt, inArray, lte } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { weeks } from "@/server/db/schema";
import { ArenaDomainError } from "@/server/arena/errors";
import { closeWeekForFinalization, finalizeWeek } from "@/server/finalization/service";
import { broadcastWeekNotification, flushPendingEmails } from "@/server/notifications/service";
import { scheduledWeekNotices } from "@/server/notifications/schedule";
import { cleanupExpiredArenaSessions } from "@/server/auth/session-retention";
import { cleanupExpiredUploads } from "@/server/storage/cleanup";
import { generateWeek, prepareScheduledWeek, publishWeek } from "@/server/generation/service";
import { createReviewProvider } from "@/server/reviews/model-router";
import { runConfiguredReviewJob } from "@/server/reviews/worker";
import { generationConfig } from "@/server/generation/core";
import { createGenerationProvider } from "@/server/generation/ai-provider";

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
  const pending = await db
    .select({ id: weeks.id, weekCode: weeks.weekCode })
    .from(weeks)
    .where(eq(weeks.status, "FINALIZING"))
    .orderBy(asc(weeks.submissionDeadlineAt));

  if (pending.length === 0) return { job: "week-finalize", done: true, detail: { skipped: "no week awaiting finalization" } };

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
  return { job: "week-finalize", done: true, detail: { finalized, waiting } };
}

/** Drain queued EMAIL deliveries. No provider key configured leaves them PENDING. */
export async function runEmailFlush(): Promise<JobResult> {
  return { job: "email-flush", done: true, detail: await flushPendingEmails({ limit: 100 }) };
}

/** Recover missed broadcasts from durable week state; events dedupe across ticks. */
export async function runWeekNotifications(now = new Date()): Promise<JobResult> {
  const open = await getDb().select().from(weeks).where(and(eq(weeks.status, "OPEN"),
    lte(weeks.opensAt, now), gt(weeks.submissionDeadlineAt, now))).orderBy(asc(weeks.opensAt));
  const results = [];
  for (const week of open) {
    for (const notice of scheduledWeekNotices(week, now)) {
      try {
        results.push({ weekId: week.id, type: notice.type, ...await broadcastWeekNotification({ ...notice, now }) });
      } catch (error) {
        if (!(error instanceof ArenaDomainError)) throw error;
        results.push({ weekId: week.id, type: notice.type, failed: 1, message: error.message });
      }
    }
  }
  return { job: "week-notifications", done: results.every((result) => !result.failed && !("batchFull" in result && result.batchFull)), detail: { results } };
}

/** Drop auth sessions past the retention window (PRD §65 Authentication). */
export async function runSessionCleanup(now = new Date()): Promise<JobResult> {
  return { job: "session-cleanup", done: true, detail: { deleted: await cleanupExpiredArenaSessions(now) } };
}

const projectJobs = {
  config: generationConfig,
  prepare: prepareScheduledWeek,
  provider: createGenerationProvider,
  generate: generateWeek,
  publish: publishWeek,
  due: async (now: Date) => getDb().select({ id: weeks.id, weekCode: weeks.weekCode }).from(weeks)
    .where(and(inArray(weeks.status, ["DRAFT", "PREVIEW", "SCHEDULED"]),
      lte(weeks.opensAt, now), gt(weeks.submissionDeadlineAt, now)))
    .orderBy(asc(weeks.opensAt)),
};

/** Prepare Sunday's preview. Publication is a separate, opening-time-gated job. */
export async function runProjectGenerate(now = new Date(), deps = projectJobs): Promise<JobResult> {
  const job = "project-generate";
  if (!deps.config().enabled) return { job, done: false, detail: { skipped: "generation disabled" } };
  const actor = { actorSubject: ACTOR, actorType: "AUTOMATION" as const };
  try {
    const prepared = await deps.prepare({ ...actor, now });
    if (!("weekId" in prepared)) {
      return { job, done: false, detail: { skipped: prepared.skipped } };
    }
    const provider = deps.provider() ?? undefined;
    const generated = await deps.generate({ ...actor, weekId: prepared.weekId, provider, now });
    return {
      job, done: generated.results.length > 0 && generated.results.every((result) => !("failed" in result)),
      detail: { weekId: prepared.weekId, created: prepared.created, provider: provider?.name ?? "library-only", results: generated.results },
    };
  } catch (error) {
    if (error instanceof ArenaDomainError) {
      return { job, done: false, detail: { failed: error.code, message: error.message } };
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
const REVIEW_DRAIN_BUDGET_MS = Number(process.env.ARENA_REVIEW_DRAIN_BUDGET_MS ?? 45_000);

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
    if (deps.clock() >= deadline) {
      stopped = "time budget reached; the next tick continues";
      break;
    }
    let completed: Awaited<ReturnType<typeof runConfiguredReviewJob>>;
    try {
      completed = await deps.runOne();
    } catch (error) {
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
} satisfies Record<string, (now?: Date) => Promise<JobResult>>;

export type JobName = keyof typeof JOBS;
