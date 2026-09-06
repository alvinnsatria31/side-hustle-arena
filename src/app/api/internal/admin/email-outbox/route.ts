import { arenaData, arenaError } from "@/server/arena/http";
import { requireArenaAdmin } from "@/server/admin/auth";
import { emailOutboxQuery, listEmailOutbox, summarizeEmailOutbox } from "@/server/notifications/outbox-admin";

export const dynamic = "force-dynamic";

/** Read surface for the EMAIL queue: bucket counts plus the rows behind them. */
export async function GET(request: Request) {
  try {
    await requireArenaAdmin(request, "notifications");
    const query = emailOutboxQuery.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!query.success) return arenaData({ reason: "VALIDATION_ERROR" }, 400);
    const now = new Date();
    const [summary, rows] = await Promise.all([
      summarizeEmailOutbox({ now }),
      listEmailOutbox(query.data, { now }),
    ]);
    return arenaData({ summary, rows });
  } catch (error) {
    return arenaError(error);
  }
}
