import { boolean, index, integer, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { ops } from "./schemas";

/**
 * Per-feature maintenance switches — transferred from sekolah-karir-website
 * (`feature_flags` table + `src/lib/feature-flags.ts`) for PRD §49 incident
 * handling: the Product Owner can pause weekly publish, hold submissions, or
 * freeze redemption without SSH and without a redeploy.
 *
 * Semantics (kept identical to the website):
 * - A feature with NO row is OPEN.
 * - A failed read is OPEN too: a database hiccup must never silently close
 *   the Arena, because that failure looks deliberate and nobody would think
 *   to go and undo it.
 * - Enforcement belongs in BOTH the page (hides buttons) and the mutation
 *   (refuses writes): an action is a public POST endpoint reachable from a
 *   tab that was already open when the switch was flipped.
 */
export const featureFlags = ops.table("feature_flags", {
  key: text("key").primaryKey(),
  maintenanceMode: boolean("maintenance_mode").default(false).notNull(),
  message: text("message"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Shared request counters for endpoints that cost money per call.
 *
 * The CV scanner's limiter used to be a `Map` in one serverless instance, so it
 * reset on every cold start and never coordinated across concurrent instances —
 * it stopped a casual loop and nothing else. Serverless has no process to keep
 * state in, so the state has to live where every instance can see it.
 *
 * A FIXED window, not a sliding one: `(bucket, subject, window_start)` makes the
 * whole check a single atomic upsert with no read-then-write race, which matters
 * far more here than the window edge. The tradeoff is honest — a caller timing a
 * burst either side of a boundary gets up to twice the allowance once — and for
 * a spend limiter that is an acceptable price for correctness under concurrency.
 *
 * Rows are pruned by the `session-cleanup` job; nothing here is durable state.
 */
export const rateLimitCounters = ops.table(
  "rate_limit_counters",
  {
    /** Which limiter, so one table serves more than the CV scanner. */
    bucket: text("bucket").notNull(),
    /** Who is being limited — a client IP today, never a user secret. */
    subject: text("subject").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").default(0).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.bucket, table.subject, table.windowStart] }),
    index("ops_rate_limit_window_idx").on(table.windowStart),
  ],
);
