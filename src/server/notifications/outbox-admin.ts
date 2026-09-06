import "server-only";
import { and, desc, eq, isNotNull, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/server/db/client";
import { deliveries, events, users } from "@/server/db/schema";
import { ArenaDomainError } from "@/server/arena/errors";
import { writeAudit } from "@/server/reviews/audit";
import { MAX_EMAIL_ATTEMPTS } from "./outbox-policy";

type Db = ReturnType<typeof getDb>;

/**
 * Operator view of the EMAIL outbox (handoff priority 3).
 *
 * `flushPendingEmails` is a worker endpoint with no read surface, so nothing
 * could answer "what is stuck, and why". These buckets are DERIVED, not stored:
 * `delivery_status` only knows PENDING/SENT/FAILED/SKIPPED, while the queue's
 * real behaviour also depends on attempt count, the retry window and the lease.
 *
 * The bucket expression mirrors `claimEmail`'s predicate on purpose. If the two
 * drift, the console starts reporting work the worker will never do — so the
 * shared constants are imported rather than re-typed, and
 * `notification-outbox-admin.test.mjs` pins the two together.
 */

/** 23h: Resend retains an idempotency key for 24h; `retryExpired` leaves the same margin. */
const IDEMPOTENCY_WINDOW_MS = 23 * 3600_000;

export const EMAIL_BUCKETS = ["due", "backingOff", "inFlight", "held", "skipped", "sent"] as const;
export type EmailBucket = (typeof EMAIL_BUCKETS)[number];

/**
 * A row is `held` when the next claim would refuse to send it: attempts are
 * exhausted, or its idempotency window closed before it ever got a receipt.
 * Both are terminal without a human — that is exactly the queue this page exists for.
 */
function bucketExpression(now: Date) {
  const cutoff = new Date(now.getTime() - IDEMPOTENCY_WINDOW_MS);
  // Timestamps are bound as ISO text with an explicit cast: inside a raw
  // template there is no column to borrow a type mapper from, so a bare Date
  // reaches the driver unserialised.
  const at = sql`${now.toISOString()}::timestamptz`;
  const closed = sql`${cutoff.toISOString()}::timestamptz`;
  return sql<EmailBucket>`case
    when ${deliveries.status} = 'SENT' then 'sent'
    when ${deliveries.status} = 'SKIPPED' then 'skipped'
    when ${deliveries.leaseExpiresAt} is not null and ${deliveries.leaseExpiresAt} > ${at} then 'inFlight'
    when ${deliveries.attemptCount} >= ${MAX_EMAIL_ATTEMPTS} then 'held'
    when ${deliveries.firstAttemptAt} is not null and ${deliveries.firstAttemptAt} <= ${closed} then 'held'
    when ${deliveries.availableAt} <= ${at} then 'due'
    else 'backingOff'
  end`;
}

const emailOnly = eq(deliveries.channel, "EMAIL");

export interface EmailOutboxSummary {
  counts: Record<EmailBucket, number>;
  /** Leases whose worker died mid-send. The next claim reclaims them; a rising number means the worker is crashing. */
  staleLeases: number;
  /** Invariant breaches worth a human look rather than a retry. */
  anomalies: { sentWithoutReceipt: number; exhaustedNotFailed: number };
  /** `flushPendingEmails` returns `unconfigured` and consumes nothing while this is false. */
  senderConfigured: boolean;
}

export async function summarizeEmailOutbox(
  input: { now?: Date } = {},
  db: Db = getDb(),
): Promise<EmailOutboxSummary> {
  const now = input.now ?? new Date();
  const bucket = bucketExpression(now);

  const grouped = await db
    .select({ bucket, total: sql<number>`count(*)::int` })
    .from(deliveries)
    .where(emailOnly)
    // Group by ordinal, not by the expression: Drizzle renders column names
    // unqualified in the select list but table-qualified in GROUP BY, and
    // Postgres then refuses to match the two as the same expression.
    .groupBy(sql`1`);

  const counts = Object.fromEntries(EMAIL_BUCKETS.map((name) => [name, 0])) as Record<EmailBucket, number>;
  for (const row of grouped) counts[row.bucket] = Number(row.total);

  const [extra] = await db
    .select({
      staleLeases: sql<number>`count(*) filter (where ${deliveries.leaseToken} is not null and ${deliveries.leaseExpiresAt} <= ${now.toISOString()}::timestamptz)::int`,
      sentWithoutReceipt: sql<number>`count(*) filter (where ${deliveries.status} = 'SENT' and ${deliveries.providerReference} is null)::int`,
      exhaustedNotFailed: sql<number>`count(*) filter (where ${deliveries.attemptCount} >= ${MAX_EMAIL_ATTEMPTS} and ${deliveries.status} not in ('FAILED', 'SENT', 'SKIPPED'))::int`,
    })
    .from(deliveries)
    .where(emailOnly);

  return {
    counts,
    staleLeases: Number(extra?.staleLeases ?? 0),
    anomalies: {
      sentWithoutReceipt: Number(extra?.sentWithoutReceipt ?? 0),
      exhaustedNotFailed: Number(extra?.exhaustedNotFailed ?? 0),
    },
    senderConfigured: Boolean(process.env.RESEND_API_KEY),
  };
}

export const emailOutboxQuery = z.object({
  bucket: z.enum(EMAIL_BUCKETS).optional(),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export interface EmailOutboxRow {
  id: string;
  bucket: EmailBucket;
  status: string;
  subject: string;
  recipient: string | null;
  attemptCount: number;
  errorCode: string | null;
  availableAt: Date;
  firstAttemptAt: Date | null;
  sentAt: Date | null;
  failedAt: Date | null;
  leaseExpiresAt: Date | null;
  createdAt: Date;
}

/**
 * The rendered HTML/text body is deliberately not selected: an operator needs
 * to know which message is stuck and why, not to read a participant's mail.
 */
export async function listEmailOutbox(
  query: z.infer<typeof emailOutboxQuery>,
  input: { now?: Date } = {},
  db: Db = getDb(),
): Promise<EmailOutboxRow[]> {
  const now = input.now ?? new Date();
  const bucket = bucketExpression(now);
  const rows = await db
    .select({
      id: deliveries.id,
      bucket,
      status: deliveries.status,
      subject: events.title,
      recipient: users.emailCache,
      attemptCount: deliveries.attemptCount,
      errorCode: deliveries.errorCode,
      availableAt: deliveries.availableAt,
      firstAttemptAt: deliveries.firstAttemptAt,
      sentAt: deliveries.sentAt,
      failedAt: deliveries.failedAt,
      leaseExpiresAt: deliveries.leaseExpiresAt,
      createdAt: deliveries.createdAt,
    })
    .from(deliveries)
    .innerJoin(events, eq(events.id, deliveries.eventId))
    .leftJoin(users, eq(users.id, events.userId))
    .where(query.bucket ? and(emailOnly, eq(bucket, query.bucket)) : emailOnly)
    .orderBy(desc(deliveries.createdAt), deliveries.id)
    .limit(query.limit)
    .offset(query.offset);
  return rows as EmailOutboxRow[];
}

export const emailOutboxMutation = z.object({
  deliveryId: z.string().uuid(),
  reason: z.string().trim().min(1).max(1000),
});

/** Refuse to race a live worker: its lease still owns the row until it expires. */
async function lockUnleased(tx: Db, deliveryId: string, now: Date) {
  const [row] = await tx.select().from(deliveries).where(eq(deliveries.id, deliveryId)).for("update");
  if (!row || row.channel !== "EMAIL") throw new ArenaDomainError("VALIDATION_ERROR", "Email delivery not found.");
  if (row.leaseExpiresAt && row.leaseExpiresAt > now) {
    throw new ArenaDomainError("VALIDATION_ERROR", "Delivery is being sent right now. Try again once its lease expires.");
  }
  return row;
}

/**
 * Hand a terminal row back to the worker.
 *
 * The frozen `messageSnapshot` is deliberately KEPT. It is the invariant that
 * makes retries idempotent — the Resend key is `arena-email/<delivery id>`, so
 * re-rendering the body here would let one key stand for two different
 * messages. Only the retry accounting is reset, which also restarts the
 * idempotency clock that `IDEMPOTENCY_WINDOW_EXPIRED` rows tripped over.
 */
export async function requeueEmailDelivery(
  input: z.infer<typeof emailOutboxMutation> & { actorSubject: string; now?: Date; db?: Db },
) {
  if (!input.actorSubject.trim()) throw new ArenaDomainError("VALIDATION_ERROR", "Actor is required.");
  const now = input.now ?? new Date();
  return (input.db ?? getDb()).transaction(async (tx) => {
    const row = await lockUnleased(tx as Db, input.deliveryId, now);
    if (row.status === "SENT") throw new ArenaDomainError("VALIDATION_ERROR", "A delivered email cannot be requeued.");
    await tx
      .update(deliveries)
      .set({
        status: "PENDING",
        attemptCount: 0,
        firstAttemptAt: null,
        errorCode: null,
        failedAt: null,
        availableAt: now,
        leaseToken: null,
        leaseExpiresAt: null,
        updatedAt: now,
      })
      .where(eq(deliveries.id, row.id));
    await writeAudit(tx as Db, {
      actorType: "ADMIN",
      actorSubject: input.actorSubject,
      action: "EMAIL_DELIVERY_REQUEUED",
      entityType: "notification_delivery",
      entityId: row.id,
      metadata: {
        previousStatus: row.status,
        previousAttemptCount: row.attemptCount,
        previousErrorCode: row.errorCode,
        reason: input.reason,
      },
    });
    return { id: row.id, status: "PENDING" as const };
  });
}

/** Stop retrying for good, on the record. SKIPPED is the queue's existing "never sent, not an error" state. */
export async function cancelEmailDelivery(
  input: z.infer<typeof emailOutboxMutation> & { actorSubject: string; now?: Date; db?: Db },
) {
  if (!input.actorSubject.trim()) throw new ArenaDomainError("VALIDATION_ERROR", "Actor is required.");
  const now = input.now ?? new Date();
  return (input.db ?? getDb()).transaction(async (tx) => {
    const row = await lockUnleased(tx as Db, input.deliveryId, now);
    if (row.status === "SENT") throw new ArenaDomainError("VALIDATION_ERROR", "A delivered email cannot be cancelled.");
    await tx
      .update(deliveries)
      .set({ status: "SKIPPED", errorCode: "ADMIN_CANCELLED", leaseToken: null, leaseExpiresAt: null, updatedAt: now })
      .where(eq(deliveries.id, row.id));
    await writeAudit(tx as Db, {
      actorType: "ADMIN",
      actorSubject: input.actorSubject,
      action: "EMAIL_DELIVERY_CANCELLED",
      entityType: "notification_delivery",
      entityId: row.id,
      metadata: { previousStatus: row.status, previousAttemptCount: row.attemptCount, reason: input.reason },
    });
    return { id: row.id, status: "SKIPPED" as const };
  });
}

/**
 * Rows the worker already gave up on, oldest first — the reconciliation list an
 * operator works through after an outage.
 */
export async function listHeldForReconciliation(
  input: { limit?: number; now?: Date } = {},
  db: Db = getDb(),
): Promise<EmailOutboxRow[]> {
  const now = input.now ?? new Date();
  return listEmailOutbox({ bucket: "held", offset: 0, limit: Math.min(Math.max(input.limit ?? 50, 1), 100) }, { now }, db);
}

/** Deliveries stuck behind a dead worker, for the same reconciliation pass. */
export async function countStaleLeases(input: { now?: Date } = {}, db: Db = getDb()): Promise<number> {
  const now = input.now ?? new Date();
  const [row] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(deliveries)
    .where(and(emailOnly, isNotNull(deliveries.leaseToken), lte(deliveries.leaseExpiresAt, now)));
  return Number(row?.total ?? 0);
}
