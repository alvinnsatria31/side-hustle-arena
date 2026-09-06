import { z } from "zod";
import { arenaData, arenaError } from "@/server/arena/http";
import { ArenaDomainError } from "@/server/arena/errors";
import { requireArenaAdmin } from "@/server/admin/auth";
import { adminJobCatalogue, adminJobs, isAdminJob, listAutomationRuns, runAdminJob } from "@/server/admin/jobs";

export const dynamic = "force-dynamic";

/**
 * The console's copy of the n8n trigger.
 *
 * `n8n/arena-trigger-workflow.json` fires `GET /api/cron/<job>` on a timer with
 * the cron secret. This runs the identical job with an admin session instead,
 * so an off-schedule launch never requires handing the cron token to a person.
 */
export async function GET(request: Request) {
  try {
    await requireArenaAdmin(request, "overview");
    return arenaData({ jobs: adminJobCatalogue(), runs: await listAutomationRuns(20) });
  } catch (error) { return arenaError(error); }
}

const runSchema = z.object({ job: z.string().trim().min(1).max(64) });

export async function POST(request: Request) {
  try {
    const parsed = runSchema.safeParse(await request.json().catch(() => null));
    // An unrecognised name is authorised against `overview` before it is
    // rejected, so this never becomes an unauthenticated probe of job names.
    if (!parsed.success || !isAdminJob(parsed.data.job)) {
      await requireArenaAdmin(request, "overview");
      throw new ArenaDomainError("VALIDATION_ERROR", "Unknown scheduled job.");
    }
    const job = parsed.data.job;
    const { actorSubject } = await requireArenaAdmin(request, adminJobs[job].scope);
    return arenaData({ result: await runAdminJob({ job, actorSubject }) });
  } catch (error) { return arenaError(error); }
}
