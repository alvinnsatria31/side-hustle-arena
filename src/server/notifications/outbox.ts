import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, isNotNull, isNull, lt, lte, or } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { deliveries, events, users } from "@/server/db/schema";
import { sendArenaEmail, type EmailResult } from "./email";
import { EMAIL_LEASE_MS, MAX_EMAIL_ATTEMPTS, emailContent, retryAt, retryExpired } from "./outbox-policy";

type Db = ReturnType<typeof getDb>;

/** Claim one at a time so slow sends do not expire a whole batch's leases. */
export async function claimEmail(db: Db, now: Date, deliveryId?: string) {
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(deliveries)
      .where(and(eq(deliveries.channel, "EMAIL"), inArray(deliveries.status, ["PENDING", "FAILED"]),
        or(lt(deliveries.attemptCount, MAX_EMAIL_ATTEMPTS), isNotNull(deliveries.leaseToken)), lte(deliveries.availableAt, now),
        deliveryId ? eq(deliveries.id, deliveryId) : undefined,
        or(isNull(deliveries.leaseExpiresAt), lte(deliveries.leaseExpiresAt, now))))
      .orderBy(asc(deliveries.availableAt), asc(deliveries.id)).limit(1).for("update", { skipLocked: true });
    if (!row) return null;
    if (retryExpired(row.firstAttemptAt, now) || row.attemptCount >= MAX_EMAIL_ATTEMPTS) {
      await tx.update(deliveries).set({ status: "FAILED", errorCode: retryExpired(row.firstAttemptAt, now) ? "IDEMPOTENCY_WINDOW_EXPIRED" : "ATTEMPTS_EXHAUSTED",
        attemptCount: MAX_EMAIL_ATTEMPTS, leaseToken: null, leaseExpiresAt: null, failedAt: now, updatedAt: now }).where(eq(deliveries.id, row.id));
      return { held: true as const };
    }
    const [event] = await tx.select({ title: events.title, body: events.body, actionUrl: events.actionUrl, email: users.emailCache, userStatus: users.status })
      .from(events).leftJoin(users, eq(users.id, events.userId)).where(eq(events.id, row.eventId));
    if (!event?.email || event.userStatus !== "ACTIVE") {
      await tx.update(deliveries).set({ status: "SKIPPED", errorCode: !event?.email ? "NO_EMAIL_ON_FILE" : "USER_INACTIVE",
        leaseToken: null, leaseExpiresAt: null, updatedAt: now }).where(eq(deliveries.id, row.id));
      return { skipped: true as const };
    }
    const message = row.messageSnapshot ?? { to: event.email, subject: event.title,
      from: process.env.ARENA_FROM_EMAIL ?? "Side-Hustle Arena <noreply@sekolahkarir.id>",
      ...emailContent(event, process.env.ARENA_ORIGIN ?? "https://arena.sekolahkarir.id") };
    const token = randomUUID();
    await tx.update(deliveries).set({ leaseToken: token, leaseExpiresAt: new Date(now.getTime() + EMAIL_LEASE_MS),
      attemptCount: row.attemptCount + 1, firstAttemptAt: row.firstAttemptAt ?? now,
      messageSnapshot: message, updatedAt: now }).where(eq(deliveries.id, row.id));
    return { id: row.id, token, message, attempt: row.attemptCount + 1, firstAttemptAt: row.firstAttemptAt };
  });
}

export async function flushPendingEmails(input: {
  limit?: number; db?: Db; now?: () => Date; sender?: typeof sendArenaEmail; deliveryId?: string;
} = {}): Promise<{ sent: number; failed: number; skipped: number; held: number; unconfigured?: boolean }> {
  const totals = { sent: 0, failed: 0, skipped: 0, held: 0 };
  // Configuration must not consume attempts or start the idempotency clock.
  if (!input.sender && !process.env.RESEND_API_KEY) return { ...totals, unconfigured: true };
  const db = input.db ?? getDb();
  const now = input.now ?? (() => new Date());
  const sender = input.sender ?? sendArenaEmail;
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);
  for (let i = 0; i < limit; i++) {
    const claim = await claimEmail(db, now(), input.deliveryId);
    if (!claim) break;
    if ("held" in claim) { totals.held++; continue; }
    if ("skipped" in claim) { totals.skipped++; continue; }
    let result: EmailResult;
    try { result = await sender(claim.message, { idempotencyKey: `arena-email/${claim.id}` }); }
    catch { result = { ok: false, error: "EMAIL_TRANSPORT_ERROR" }; }
    const finishedAt = now();
    const receipt = result.ok && !result.skipped && result.id;
    const skipped = result.ok && result.skipped;
    const updated = await db.update(deliveries).set({
      status: receipt ? "SENT" : skipped ? "PENDING" : "FAILED",
      providerReference: receipt || null, sentAt: receipt ? finishedAt : null,
      failedAt: !receipt && !skipped ? finishedAt : null,
      errorCode: result.ok ? (skipped ? null : receipt ? null : "RESEND_RECEIPT_MISSING") : result.error.slice(0, 100),
      availableAt: retryAt(claim.attempt, finishedAt), leaseToken: null, leaseExpiresAt: null, updatedAt: finishedAt,
      ...(skipped ? { attemptCount: claim.attempt - 1, firstAttemptAt: claim.firstAttemptAt } : {}),
    }).where(and(eq(deliveries.id, claim.id), eq(deliveries.leaseToken, claim.token))).returning({ id: deliveries.id });
    if (!updated.length) { totals.held++; continue; }
    if (receipt) totals.sent++;
    else if (!skipped) totals.failed++;
  }
  return totals;
}
