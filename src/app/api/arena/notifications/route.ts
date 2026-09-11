import { z } from "zod";
import { getCurrentUser } from "@/server/auth";
import { hasAllowedMutationOrigin } from "@/server/auth/origin";
import { arenaData, arenaError, arenaUnauthorized } from "@/server/arena";
import { arenaForbidden } from "@/server/arena/http";
import { getUnreadCount, listUserNotificationPage } from "@/server/notifications/service";

export const dynamic = "force-dynamic";

/**
 * Own inbox, newest first. `?unread=1` filters unread, `?limit=` caps a page at
 * 100, and `?cursor=` (the previous page's `nextCursor`) continues into older
 * history — there is no ceiling on how far back a participant can read.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return arenaUnauthorized();
  try {
    const params = new URL(request.url).searchParams;
    const unreadOnly = params.get("unread") === "1";
    const limit = Number(params.get("limit") ?? 20);
    const [page, unread] = await Promise.all([
      listUserNotificationPage(user.id, { unreadOnly, limit: Number.isFinite(limit) ? limit : 20, cursor: params.get("cursor") }),
      getUnreadCount(user.id),
    ]);
    return arenaData({ items: page.items, nextCursor: page.nextCursor, unread });
  } catch (error) {
    return arenaError(error);
  }
}

const readSchema = z.object({
  eventIds: z.array(z.string().uuid()).max(100).optional(),
  all: z.boolean().optional(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return arenaUnauthorized();
  if (!hasAllowedMutationOrigin(request)) return arenaForbidden();
  try {
    const { markAllNotificationsRead, markNotificationsRead } = await import("@/server/notifications/service");
    const parsed = readSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return arenaData({ read: false, reason: "VALIDATION_ERROR" }, 400);
    if (parsed.data.all) return arenaData({ read: await markAllNotificationsRead(user.id) });
    return arenaData({ read: await markNotificationsRead(user.id, parsed.data.eventIds ?? []) });
  } catch (error) {
    return arenaError(error);
  }
}
