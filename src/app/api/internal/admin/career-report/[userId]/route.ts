import { z } from "zod";
import { arenaData, arenaError } from "@/server/arena/http";
import { requireArenaAdmin } from "@/server/admin/auth";
import { previewAdminCareerReport } from "@/server/admin/career-report";

export const dynamic = "force-dynamic";

/** One participant's Career Report as they see it. Each read is audited. */
export async function GET(request: Request, context: { params: Promise<{ userId: string }> }) {
  try {
    const { actorSubject } = await requireArenaAdmin(request, "users");
    const { userId } = await context.params;
    if (!z.string().uuid().safeParse(userId).success) return arenaData({ reason: "VALIDATION_ERROR" }, 400);
    return arenaData(await previewAdminCareerReport({ userId, actorSubject }));
  } catch (error) { return arenaError(error); }
}
