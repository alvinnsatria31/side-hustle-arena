import "server-only";
import { and, asc, eq, lte } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { weeks } from "@/server/db/schema";
import { ArenaDomainError } from "@/server/arena/errors";
import { closeWeekForFinalization, finalizeWeek } from "@/server/finalization/service";
import { flushPendingEmails } from "@/server/notifications/service";
import { cleanupExpiredArenaSessions } from "@/server/auth/session-retention";

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

/** Drop auth sessions past the retention window (PRD §65 Authentication). */
export async function runSessionCleanup(now = new Date()): Promise<JobResult> {
  return { job: "session-cleanup", done: true, detail: { deleted: await cleanupExpiredArenaSessions(now) } };
}

/**
 * PLACEHOLDER: Monday project drop.
 *
 * The weekly generator (Hermes generation, validation, anti-duplicate,
 * library/evergreen fallback, auto-publish — PRD §65 "Project Generation") does
 * not exist yet. This job reports that honestly instead of pretending a drop
 * happened, so a scheduled Monday that produced nothing is visible in the cron
 * log rather than silent. Replace the body when the generator lands.
 */
export async function runProjectDrop(): Promise<JobResult> {
  return {
    job: "project-drop",
    done: false,
    detail: { notImplemented: "Weekly project generation is not built yet; publish next week's projects by hand." },
  };
}

export const JOBS = {
  "week-close": runWeekClose,
  "week-finalize": runWeekFinalize,
  "email-flush": runEmailFlush,
  "session-cleanup": runSessionCleanup,
  "project-drop": runProjectDrop,
} satisfies Record<string, (now?: Date) => Promise<JobResult>>;

export type JobName = keyof typeof JOBS;
