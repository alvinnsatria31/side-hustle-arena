import { arenaData, arenaError } from "@/server/arena/http";
import { requireArenaAdmin } from "@/server/admin/auth";
import { cancelEmailDelivery, emailOutboxMutation, requeueEmailDelivery } from "@/server/notifications/outbox-admin";

export const dynamic = "force-dynamic";

/**
 * Operator actions on a stuck delivery. Both are audited and both refuse a row
 * whose lease is still live, so an admin can never race the flush worker.
 */
export async function POST(request: Request, context: { params: Promise<{ action: string }> }) {
  try {
    const { actorSubject } = await requireArenaAdmin(request, "notifications");
    const { action } = await context.params;
    if (action !== "requeue" && action !== "cancel") return arenaData({ reason: "UNKNOWN_ACTION" }, 404);
    const parsed = emailOutboxMutation.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return arenaData({ reason: "VALIDATION_ERROR" }, 400);
    const run = action === "requeue" ? requeueEmailDelivery : cancelEmailDelivery;
    return arenaData({ done: await run({ ...parsed.data, actorSubject }) });
  } catch (error) {
    return arenaError(error);
  }
}
