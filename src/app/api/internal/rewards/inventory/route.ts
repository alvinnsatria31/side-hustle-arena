import { arenaData, arenaError } from "@/server/arena/http";
import { requireArenaAdmin } from "@/server/admin/auth";
import { inventoryMutation, listAdminInventory, listQuery, updateAdminInventory } from "@/server/admin/operations";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    await requireArenaAdmin(request, "rewards");
    const query = listQuery.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!query.success) return arenaData({ reason: "VALIDATION_ERROR" }, 400);
    return arenaData(await listAdminInventory(query.data));
  } catch (error) { return arenaError(error); }
}
export async function POST(request: Request) {
  try {
    const { actorSubject } = await requireArenaAdmin(request, "rewards");
    const parsed = inventoryMutation.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return arenaData({ reason: "VALIDATION_ERROR" }, 400);
    return arenaData({ done: await updateAdminInventory({ ...parsed.data, actorSubject }) });
  } catch (error) { return arenaError(error); }
}
