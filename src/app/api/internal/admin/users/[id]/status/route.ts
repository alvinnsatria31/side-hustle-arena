import { z } from "zod";
import { arenaData, arenaError } from "@/server/arena/http";
import { requireArenaAdmin } from "@/server/admin/auth";
import { setAdminUserStatus } from "@/server/admin/operations";

const schema = z.object({ status: z.enum(["ACTIVE", "SUSPENDED"]), reason: z.string().trim().min(1).max(1000) });
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { actorSubject } = await requireArenaAdmin(request, "users");
    const { id } = await context.params;
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success || !z.string().uuid().safeParse(id).success) return arenaData({ reason: "VALIDATION_ERROR" }, 400);
    return arenaData({ done: await setAdminUserStatus({ ...parsed.data, userId: id, actorSubject }) });
  } catch (error) { return arenaError(error); }
}
