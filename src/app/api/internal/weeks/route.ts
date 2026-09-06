import { arenaData, arenaError } from "@/server/arena/http";
import { requireArenaAdmin } from "@/server/admin/auth";
import { listAdminWeeks, listQuery } from "@/server/admin/operations";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    await requireArenaAdmin(request, "weeks");
    const query = listQuery.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!query.success) return arenaData({ reason: "VALIDATION_ERROR" }, 400);
    return arenaData({ weeks: await listAdminWeeks(query.data) });
  } catch (error) { return arenaError(error); }
}
