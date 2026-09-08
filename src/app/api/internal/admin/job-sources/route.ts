import { z } from "zod";
import { arenaData, arenaError } from "@/server/arena/http";
import { ArenaDomainError } from "@/server/arena/errors";
import { requireArenaAdmin } from "@/server/admin/auth";
import { EXECUTION_CONTRACT, createExecutionBudget } from "@/server/ops/execution-budget";
import { getJobSourceStatus, setJobSourceActive, syncJobSource } from "@/server/career/jobs/sync-service";

export const dynamic = "force-dynamic";
/** See EXECUTION_CONTRACT.invocationSeconds — one ceiling for every synced path. */
export const maxDuration = 60;

/**
 * Operational view of the jobs pipeline, and the two buttons an operator needs.
 *
 * The response deliberately names the environment variable a source expects and
 * says whether it is set, but never reads its value: an operator needs to know
 * which credential is missing, and nobody needs the credential itself in a
 * browser payload.
 */
export async function GET(request: Request) {
  try {
    await requireArenaAdmin(request, "careers");
    return arenaData({ sources: await getJobSourceStatus() });
  } catch (error) { return arenaError(error); }
}

const actionSchema = z.object({
  sourceId: z.string().uuid(),
  action: z.enum(["sync", "enable", "disable"]),
});

export async function POST(request: Request) {
  try {
    const { actorSubject } = await requireArenaAdmin(request, "careers");
    const parsed = actionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ArenaDomainError("VALIDATION_ERROR", "Unknown job source action.");
    if (parsed.data.action === "sync") {
      // A manual sync is the same code path as the scheduled one, with an admin
      // actor. It carries a unique idempotency key so an operator pressing the
      // button twice gets two honest runs rather than a silent no-op — the
      // per-source lease is what stops them overlapping.
      const result = await syncJobSource({
        sourceId: parsed.data.sourceId,
        triggeredBy: `admin:${actorSubject}`,
        idempotencyKey: `jobs-sync:manual:${parsed.data.sourceId}:${Date.now()}`,
        budget: createExecutionBudget(EXECUTION_CONTRACT.drainBudgetMs),
      });
      return arenaData({ result });
    }
    return arenaData({
      result: await setJobSourceActive({
        sourceId: parsed.data.sourceId,
        isActive: parsed.data.action === "enable",
        actorSubject,
      }),
    });
  } catch (error) { return arenaError(error); }
}
