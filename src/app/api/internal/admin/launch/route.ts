import { arenaData, arenaError } from "@/server/arena/http";
import { requireArenaAdmin } from "@/server/admin/auth";
import { launchProjectRun, launchSchema } from "@/server/admin/launch";

export const dynamic = "force-dynamic";
// Generation calls a model per division; the default serverless ceiling is not
// enough for a multi-division release.
export const maxDuration = 300;

/**
 * Off-schedule project release.
 *
 * One endpoint serves both callers because `requireArenaAdmin` already accepts
 * either: a signed-in operator using the console, or n8n presenting
 * `INTERNAL_ADMIN_TOKEN` whose `INTERNAL_ADMIN_SCOPES` include `projects`.
 * n8n therefore needs no bespoke authentication path, and nothing it sends
 * chooses the actor — the guard supplies it for the audit trail.
 */
export async function POST(request: Request) {
  try {
    const { actorSubject } = await requireArenaAdmin(request, "projects");
    const parsed = launchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return arenaData({ reason: "VALIDATION_ERROR", issues: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`) }, 400);
    }
    return arenaData(await launchProjectRun({ ...parsed.data, actorSubject }));
  } catch (error) { return arenaError(error); }
}
