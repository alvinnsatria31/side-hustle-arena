import { boolean, text, timestamp } from "drizzle-orm/pg-core";
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
