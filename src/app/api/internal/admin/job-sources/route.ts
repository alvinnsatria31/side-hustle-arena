import { z } from "zod";
import { arenaData, arenaError } from "@/server/arena/http";
import { ArenaDomainError } from "@/server/arena/errors";
import { requireArenaAdmin } from "@/server/admin/auth";
import { createAdminJobSource, jobSourceCreateSchema } from "@/server/admin/operations";
import { EXECUTION_CONTRACT, createExecutionBudget } from "@/server/ops/execution-budget";
import { getJobSourceStatus, setJobSourceActive, syncJobSource } from "@/server/career/jobs/sync-service";

export const dynamic = "force-dynamic";
/** See EXECUTION_CONTRACT.invocationSeconds — one ceiling for every synced path. */
export const maxDuration = 60;

/**
 * Operational view of the jobs pipeline, and the buttons an operator needs.
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

const createSchema = jobSourceCreateSchema.extend({
  action: z.literal("create"),
  /** Pull the first page straight away, so the operator sees the feed work (or not) now. */
  syncNow: z.boolean().default(false),
});

function manualSync(sourceId: string, actorSubject: string, key: string) {
  return syncJobSource({
    sourceId,
    triggeredBy: `admin:${actorSubject}`,
    idempotencyKey: key,
    budget: createExecutionBudget(EXECUTION_CONTRACT.drainBudgetMs),
  });
}

export async function POST(request: Request) {
  try {
    const { actorSubject } = await requireArenaAdmin(request, "careers");
    const body: unknown = await request.json().catch(() => null);

    if ((body as { action?: unknown } | null)?.action === "create") {
      const parsed = createSchema.safeParse(body);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        throw new ArenaDomainError("VALIDATION_ERROR", `Isian tidak valid (${issue?.path.join(".") || "form"}): ${issue?.message ?? "periksa lagi"}.`);
      }
      const created = await createAdminJobSource({ ...parsed.data, actorSubject });
      // The source is committed before the first pull: a feed that fails its
      // first sync is still a registered source the operator can fix and retry,
      // so the failure is reported alongside it rather than undoing it.
      let sync = null;
      let syncError: string | null = null;
      if (parsed.data.syncNow && created.isActive) {
        try {
          sync = await manualSync(created.id, actorSubject, `jobs-sync:first:${created.id}`);
        } catch (error) {
          syncError = error instanceof Error ? error.message : "Sync pertama gagal.";
        }
      }
      return arenaData({ result: { created, sync, syncError } }, 201);
    }

    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) throw new ArenaDomainError("VALIDATION_ERROR", "Unknown job source action.");
    if (parsed.data.action === "sync") {
      // A manual sync is the same code path as the scheduled one, with an admin
      // actor. It carries a unique idempotency key so an operator pressing the
      // button twice gets two honest runs rather than a silent no-op — the
      // per-source lease is what stops them overlapping.
      const result = await manualSync(parsed.data.sourceId, actorSubject, `jobs-sync:manual:${parsed.data.sourceId}:${Date.now()}`);
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
