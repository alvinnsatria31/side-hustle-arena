import "server-only";
import { gte, sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { cvScans } from "@/server/db/schema";
import { getSpendWindow } from "@/server/cv/rate-limit";

/**
 * What an operator can know about CV Scanner.
 *
 * Deliberately thin, because the product is deliberately thin: `cv_scans`
 * stores the result and nothing else — never the uploaded file, never the
 * extracted text — so there is no content to moderate and no per-scan detail
 * worth surfacing. What remains operational is volume and the hourly ceiling,
 * which is the pair that answers "is this about to start refusing people".
 *
 * The spend window reports itself as unavailable rather than zero when the
 * counter cannot be read, and that distinction is carried through untouched:
 * "no scans this hour" and "we cannot see the counter" are opposite facts.
 */
export async function getCvScannerOps(db = getDb(), now = new Date()) {
  const since = (hours: number) => new Date(now.getTime() - hours * 3600_000);

  const [spend, [today], [week]] = await Promise.all([
    getSpendWindow(now.getTime(), db),
    db.select({ count: sql<number>`count(*)::int` }).from(cvScans).where(gte(cvScans.createdAt, since(24))),
    db.select({ count: sql<number>`count(*)::int` }).from(cvScans).where(gte(cvScans.createdAt, since(24 * 7))),
  ]);

  return {
    spend,
    scansLast24h: today?.count ?? 0,
    scansLast7d: week?.count ?? 0,
    checkedAt: now,
  };
}
