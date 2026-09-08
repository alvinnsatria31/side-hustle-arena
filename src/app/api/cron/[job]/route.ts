import { arenaData, arenaError } from "@/server/arena";
import { ArenaDomainError } from "@/server/arena/errors";
import { requireCronCaller } from "@/server/scheduler/cron-auth";
import { JOBS, type JobName } from "@/server/scheduler/service";
import { getDb } from "@/server/db/client";
import { writeAudit } from "@/server/reviews/audit";

export const dynamic = "force-dynamic";

/**
 * The ceiling every scheduled job runs under.
 *
 * 60s is the free-plan hard limit, and `reviews-run` is the job that can
 * approach it: its drain budget (ARENA_REVIEW_DRAIN_BUDGET_MS, 45s) is sized to
 * finish inside this with room for the response. Leaving it unset meant the
 * platform default applied here while `/api/internal/reviews/run` declared 300
 * — the same work with two different ceilings depending on who triggered it.
 */
export const maxDuration = 60;

/**
 * Scheduled-job entrypoint. Vercel Cron issues a GET with the cron secret as a
 * bearer token, so this is a GET even though the jobs write — access is gated
 * by `requireCronCaller`, never by the method.
 */
export async function GET(request: Request, context: { params: Promise<{ job: string }> }) {
  try {
    requireCronCaller(request);
    const { job } = await context.params;
    const run = JOBS[job as JobName];
    if (!run) throw new ArenaDomainError("VALIDATION_ERROR", `Unknown scheduled job "${job}".`);
    const startedAt = Date.now();
    const result = await run();
    // The heartbeat. Without a row per scheduled run, "this job has not fired
    // for a day" is unanswerable — and a timer that silently stopped is the
    // failure mode nothing else surfaces, because everything simply looks calm.
    // Best-effort: a heartbeat write must never fail the job it is recording.
    await writeAudit(getDb(), {
      actorType: "SYSTEM",
      actorSubject: "cron",
      action: "SCHEDULED_JOB_RAN",
      entityType: "scheduled_job",
      entityId: job,
      metadata: { done: result.done, durationMs: Date.now() - startedAt, detail: result.detail },
    }).catch((error) => console.warn(`[cron] heartbeat for ${job} could not be recorded:`, error));
    return arenaData(result);
  } catch (error) {
    return arenaError(error);
  }
}
