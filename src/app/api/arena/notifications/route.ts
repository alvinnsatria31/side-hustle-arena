import { z } from "zod";
import { getCurrentUser } from "@/server/auth";
import { arenaData, arenaError, arenaUnauthorized } from "@/server/arena";
import { getUnreadCount, listUserNotifications } from "@/server/notifications/service";

export const dynamic = "force-dynamic";

/** Own inbox: newest first. `?unread=1` filters unread, `?limit=` caps at 100. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return arenaUnauthorized();
  try {
    const params = new URL(request.url).searchParams;
    const unreadOnly = params.get("unread") === "1";
    const limit = Number(params.get("limit") ?? 20);
    const [items, unread] = await Promise.all([
      listUserNotifications(user.id, { unreadOnly, limit: Number.isFinite(limit) ? limit : 20 }),
      getUnreadCount(user.id),
    ]);
    return arenaData({ items, unread });
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
