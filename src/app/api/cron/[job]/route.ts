import { arenaData, arenaError } from "@/server/arena";
import { ArenaDomainError } from "@/server/arena/errors";
import { requireCronCaller } from "@/server/scheduler/cron-auth";
import { JOBS, type JobName } from "@/server/scheduler/service";

export const dynamic = "force-dynamic";

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
    return arenaData(await run());
  } catch (error) {
    return arenaError(error);
  }
}
