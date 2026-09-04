import "server-only";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { deliveries, enrollments, events, users } from "@/server/db/schema";
import { sendArenaEmail } from "./email";
import type { notificationChannel, notificationType } from "@/server/db/schema";

type Db = ReturnType<typeof getDb>;
type NotificationType = typeof notificationType.enumValues[number];
type NotificationChannel = typeof notificationChannel.enumValues[number];

export interface NotifyInput {
  type: NotificationType;
  userId: string | null;
  weekId?: string | null;
  title: string;
  body: string;
  actionUrl?: string | null;
  /** Defaults to IN_APP (synchronous inbox). Other channels land PENDING for a future sender. */
  channels?: NotificationChannel[];
}

/**
 * Durable notification writer (PRD §36). The event row IS the notification —
 * entitlement to know never depends on a delivery provider. IN_APP deliveries
 * complete synchronously; external channels stay PENDING until a sender
 * (Resend/WA/Discord worker) claims them.
 */
export async function notify(input: NotifyInput, db: Db = getDb()): Promise<{ eventId: string }> {
  const channels = input.channels?.length ? [...new Set(input.channels)] : (["IN_APP"] as NotificationChannel[]);
  const [event] = await db
    .insert(events)
    .values({
      type: input.type,
      userId: input.userId,
      weekId: input.weekId ?? null,
      title: input.title,
      body: input.body,
      actionUrl: input.actionUrl ?? null,
    })
    .returning({ id: events.id });
  const now = new Date();
  await db.insert(deliveries).values(
    channels.map((channel) => ({
      eventId: event.id,
      channel,
      status: (channel === "IN_APP" ? "SENT" : "PENDING") as "SENT" | "PENDING",
      sentAt: channel === "IN_APP" ? now : null,
    })),
  );
  return { eventId: event.id };
}

/**
 * Best-effort wrapper for triggers inside user flows (submit/finalize).
 * A notification must never break a submission or an award — failures are
 * logged and swallowed, exactly like the website's milestone nudge philosophy.
 */
export async function notifyBestEffort(input: NotifyInput, db?: Db): Promise<void> {
  try {
    await notify(input, db);
  } catch (error) {
    console.error(`[notifications] best-effort ${input.type} failed:`, error);
  }
}

/**
 * Week broadcast for scheduler-owned types (PROJECT_DROP Monday,
 * DEADLINE_REMINDER Friday). Called by Hermes/cron via the internal API —
 * there is no in-app scheduler yet. One event per enrolled user; failures
 * are per-user best-effort and never abort the broadcast.
 */
export async function broadcastWeekNotification(
  input: { type: "PROJECT_DROP" | "DEADLINE_REMINDER"; weekId: string; title: string; body: string; actionUrl?: string | null },
  db: Db = getDb(),
): Promise<{ notified: number }> {
  const rows = await db
    .select({ userId: enrollments.userId })
    .from(enrollments)
    .where(eq(enrollments.weekId, input.weekId));
  const uniqueUsers = [...new Set(rows.map((row) => row.userId))];
  let notified = 0;
  for (const userId of uniqueUsers) {
    try {
      await notify({ type: input.type, userId, weekId: input.weekId, title: input.title, body: input.body, actionUrl: input.actionUrl ?? null }, db);
      notified += 1;
    } catch (error) {
      console.error(`[notifications] broadcast ${input.type} failed for user:`, error);
    }
  }
  return { notified };
}

export interface InboxItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  actionUrl: string | null;
  readAt: Date | null;
  createdAt: Date;
}

/** User-scoped inbox (IDOR-safe: userId always comes from the server session). */
export async function listUserNotifications(
  userId: string,
  options: { limit?: number; unreadOnly?: boolean } = {},
  db: Db = getDb(),
): Promise<InboxItem[]> {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
  const conditions = [eq(events.userId, userId)];
  if (options.unreadOnly) conditions.push(isNull(events.readAt));
  const rows = await db
    .select({
      id: events.id,
      type: events.type,
      title: events.title,
      body: events.body,
      actionUrl: events.actionUrl,
      readAt: events.readAt,
      createdAt: events.createdAt,
    })
    .from(events)
    .where(and(...conditions))
    .orderBy(desc(events.createdAt))
    .limit(limit);
  return rows;
}

export async function getUnreadCount(userId: string, db: Db = getDb()): Promise<number> {
  const rows = (await db.execute(sql`
    select count(*)::int as n from notifications.events where user_id = ${userId} and read_at is null
  `)) as unknown as Array<{ n: number }>;
  return rows[0]?.n ?? 0;
}

export async function markNotificationsRead(
  userId: string,
  eventIds: string[],
  db: Db = getDb(),
): Promise<{ marked: number }> {
  if (eventIds.length === 0) return { marked: 0 };
  const unique = [...new Set(eventIds)].slice(0, 100);
  const now = new Date();
  let marked = 0;
  for (const eventId of unique) {
    const updated = await db
      .update(events)
      .set({ readAt: now })
      .where(and(eq(events.id, eventId), eq(events.userId, userId), isNull(events.readAt)))
      .returning({ id: events.id });
    marked += updated.length;
  }
  return { marked };
}

export async function markAllNotificationsRead(userId: string, db: Db = getDb()): Promise<{ marked: number }> {
  const updated = await db
    .update(events)
    .set({ readAt: new Date() })
    .where(and(eq(events.userId, userId), isNull(events.readAt)))
    .returning({ id: events.id });
  return { marked: updated.length };
}

/**
 * Flush queued EMAIL deliveries (called by Hermes/cron — no in-app
 * scheduler yet). Each delivery resolves exactly once: SENT with the
 * provider id, FAILED with the reason (retried next flush), or SKIPPED
 * when the user has no email on file. A failed send costs a resend click,
 * never the underlying reward/entitlement.
 */
export async function flushPendingEmails(
  input: { limit?: number; db?: Db } = {},
): Promise<{ sent: number; failed: number; skipped: number }> {
  const db = input.db ?? getDb();
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);
  const pending = await db
    .select({
      deliveryId: deliveries.id,
      title: events.title,
      body: events.body,
      email: users.emailCache,
    })
    .from(deliveries)
    .innerJoin(events, eq(deliveries.eventId, events.id))
    .leftJoin(users, eq(events.userId, users.id))
    .where(and(eq(deliveries.channel, "EMAIL"), eq(deliveries.status, "PENDING")))
    .orderBy(desc(deliveries.createdAt))
    .limit(limit);
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  for (const row of pending) {
    if (!row.email) {
      await db.update(deliveries).set({ status: "SKIPPED", errorCode: "NO_EMAIL_ON_FILE" }).where(eq(deliveries.id, row.deliveryId));
      skipped += 1;
      continue;
    }
    const result = await sendArenaEmail({ to: row.email, subject: row.title, html: `<p>${row.body}</p>`, text: row.body });
    if (result.ok && !result.skipped) {
      await db
        .update(deliveries)
        .set({ status: "SENT", providerReference: result.id ?? null, sentAt: new Date(), errorCode: null })
        .where(eq(deliveries.id, row.deliveryId));
      sent += 1;
    } else if (result.ok) {
      // No key configured: leave PENDING (not skipped, not failed) so a
      // future configured flush still delivers it.
    } else {
      await db
        .update(deliveries)
        .set({ status: "FAILED", errorCode: result.error.slice(0, 100), failedAt: new Date() })
        .where(eq(deliveries.id, row.deliveryId));
      failed += 1;
    }
  }
  return { sent, failed, skipped };
}
