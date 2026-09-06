import { z } from "zod";
import { arenaData, arenaError } from "@/server/arena/http";
import { requireArenaAdmin } from "@/server/admin/auth";
import { listAdminReviews, listQuery } from "@/server/admin/operations";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    await requireArenaAdmin(request, "reviews");
    const query = listQuery.extend({ status: z.enum(["PROCESSING", "COMPLETED_HIDDEN", "NEEDS_RESOLUTION", "PUBLISHED", "FAILED", "VOIDED"]).optional() })
      .safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!query.success) return arenaData({ reason: "VALIDATION_ERROR" }, 400);
    return arenaData({ reviews: await listAdminReviews(query.data, query.data.status) });
  } catch (error) { return arenaError(error); }
}
