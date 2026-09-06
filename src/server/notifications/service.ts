import "server-only";
import { and, asc, desc, eq, isNull, ne, sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { deliveries, enrollments, events, users, weeks } from "@/server/db/schema";
import { ArenaDomainError } from "@/server/arena/errors";
export { flushPendingEmails } from "./outbox";
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
  dedupeKey?: string;
  /** Transactional notices queue EMAIL too; point/milestone nudges remain inbox-only. */
  channels?: NotificationChannel[];
}

/**
 * Durable notification writer (PRD §36). The event row IS the notification —
 * entitlement to know never depends on a delivery provider. IN_APP deliveries
 * complete synchronously; external channels stay PENDING until a sender
 * (Resend/WA/Discord worker) claims them.
 */
export async function notify(input: NotifyInput, db: Db = getDb()): Promise<{ eventId: string; created: boolean }> {
  const emailTypes: NotificationType[] = ["PROJECT_DROP", "DEADLINE_REMINDER", "SUBMISSION_RECEIVED", "SUBMISSION_ACCESS_FAILED", "RESULT_READY", "REWARD_REDEEMED", "REWARD_FULFILLED"];
  const channels = input.channels?.length ? [...new Set(input.channels)]
    : (["IN_APP", ...(emailTypes.includes(input.type) ? ["EMAIL"] : [])] as NotificationChannel[]);
  // Nested transactions become savepoints inside submit/finalize/reward writes.
  return db.transaction(async (tx) => {
    const [event] = await tx.insert(events).values({
        type: input.type, userId: input.userId, weekId: input.weekId ?? null,
        title: input.title, body: input.body, actionUrl: input.actionUrl ?? null, dedupeKey: input.dedupeKey ?? null,
      }).onConflictDoNothing({ target: events.dedupeKey }).returning({ id: events.id });
    if (!event) {
      const [existing] = await tx.select({ id: events.id }).from(events).where(eq(events.dedupeKey, input.dedupeKey!));
      return { eventId: existing.id, created: false };
    }
    const now = new Date();
    await tx.insert(deliveries).values(channels.map((channel) => ({
        eventId: event.id, channel,
        status: (channel === "IN_APP" ? "SENT" : "PENDING") as "SENT" | "PENDING",
        sentAt: channel === "IN_APP" ? now : null,
      })));
    return { eventId: event.id, created: true };
  });
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
 * Bounded, repeatable broadcast. Project drops include historical Arena
 * participants; reminders target only this week's unfinished enrollments.
 */
export async function broadcastWeekNotification(
  input: { type: "PROJECT_DROP" | "DEADLINE_REMINDER"; weekId: string; title: string; body: string; actionUrl?: string | null; now?: Date },
  db: Db = getDb(),
): Promise<{ notified: number; failed: number; alreadyNotified: number; batchFull: boolean }> {
  const now = input.now ?? new Date();
  const [week] = await db.select().from(weeks).where(eq(weeks.id, input.weekId));
  if (!week || week.status !== "OPEN" || now < week.opensAt || now >= week.submissionDeadlineAt) {
    throw new ArenaDomainError("WEEK_NOT_READY", "Notifications require an open week within its submission window.");
  }
  const prefix = `${input.type}:${input.weekId}:`;
  const rows = await db
    .selectDistinct({ userId: enrollments.userId })
    .from(enrollments)
    .innerJoin(users, eq(users.id, enrollments.userId))
    .where(and(eq(users.status, "ACTIVE"), ne(enrollments.status, "VOIDED"),
      input.type === "DEADLINE_REMINDER" ? and(eq(enrollments.weekId, input.weekId), eq(enrollments.status, "ACTIVE")) : undefined,
      sql`not exists (select 1 from ${events} where ${events.dedupeKey} = ${prefix} || ${enrollments.userId}::text)`))
    .orderBy(asc(enrollments.userId)).limit(100);
  let notified = 0; let failed = 0; let alreadyNotified = 0;
  for (const { userId } of rows) {
    try {
      const result = await notify({ type: input.type, userId, weekId: input.weekId, title: input.title, body: input.body,
        actionUrl: input.actionUrl ?? null, dedupeKey: `${prefix}${userId}` }, db);
      if (result.created) notified++;
      else alreadyNotified++;
    } catch (error) {
      failed++;
      console.error(`[notifications] broadcast ${input.type} failed for user:`, error);
    }
  }
  return { notified, failed, alreadyNotified, batchFull: rows.length === 100 };
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
