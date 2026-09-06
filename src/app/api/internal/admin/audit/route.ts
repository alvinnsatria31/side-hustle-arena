import { arenaData, arenaError } from "@/server/arena/http";
import { requireArenaAdmin } from "@/server/admin/auth";
import { auditEntityTypes, auditQuery, listAuditLog } from "@/server/admin/audit";

export const dynamic = "force-dynamic";

/**
 * The audit trail is read under `overview`: seeing the record of what happened
 * is a supervisory act every admin scope implies, not a power over any one
 * area. Writing is not offered at all — `audit.logs` is append-only.
 */
export async function GET(request: Request) {
  try {
    await requireArenaAdmin(request, "overview");
    const url = new URL(request.url);
    const parsed = auditQuery.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) return arenaData({ reason: "VALIDATION_ERROR" }, 400);
    const [page, entityTypes] = await Promise.all([
      listAuditLog(parsed.data),
      // Only the first page needs the filter vocabulary; later pages already have it.
      parsed.data.before ? Promise.resolve<string[] | null>(null) : auditEntityTypes(),
    ]);
    return arenaData({ ...page, ...(entityTypes ? { entityTypes } : {}) });
  } catch (error) {
    return arenaError(error);
  }
}
