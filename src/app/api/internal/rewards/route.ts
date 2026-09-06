import { z } from "zod";
import { arenaData, arenaError } from "@/server/arena/http";
import { requireArenaAdmin } from "@/server/admin/auth";
import { listAdminRedemptions, listQuery } from "@/server/admin/operations";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    await requireArenaAdmin(request, "rewards");
    const query = listQuery.extend({ status: z.enum(["PENDING", "PROCESSING", "FULFILLED", "FAILED", "ADMIN_REVERSED"]).optional() })
      .safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!query.success) return arenaData({ reason: "VALIDATION_ERROR" }, 400);
    return arenaData({ redemptions: await listAdminRedemptions(query.data, query.data.status) });
  } catch (error) { return arenaError(error); }
}
