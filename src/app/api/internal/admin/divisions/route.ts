import { arenaData, arenaError } from "@/server/arena/http";
import { requireArenaAdmin } from "@/server/admin/auth";
import { createAdminDivision, divisionSchema, divisionUpdateSchema, listAdminDivisions, updateAdminDivision } from "@/server/admin/content";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireArenaAdmin(request, "projects");
    return arenaData({ divisions: await listAdminDivisions() });
  } catch (error) { return arenaError(error); }
}

export async function POST(request: Request) {
  try {
    const { actorSubject } = await requireArenaAdmin(request, "projects");
    const parsed = divisionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return arenaData({ reason: "VALIDATION_ERROR" }, 400);
    return arenaData({ division: await createAdminDivision({ ...parsed.data, actorSubject }) });
  } catch (error) { return arenaError(error); }
}

export async function PATCH(request: Request) {
  try {
    const { actorSubject } = await requireArenaAdmin(request, "projects");
    const parsed = divisionUpdateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return arenaData({ reason: "VALIDATION_ERROR" }, 400);
    return arenaData({ division: await updateAdminDivision({ ...parsed.data, actorSubject }) });
  } catch (error) { return arenaError(error); }
}
