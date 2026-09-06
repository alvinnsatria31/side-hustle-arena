import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/server/db/client";
import { cvScans, users } from "@/server/db/schema";
import type { CvResult } from "@/types/cv";

// Hardcoded product limit: keep the latest 50 consented analyses per account.
export const CV_HISTORY_LIMIT = 50;
const score = z.number().int().min(0).max(100);
const check = z.object({ label: z.string().max(80), pass: z.boolean(), note: z.string().max(220) });
/** Explicit allowlist also prevents accidental raw document persistence. */
export const cvHistoryResultSchema = z.object({
  score, statusLabel: z.string().max(40),
  metrics: z.array(z.object({ key: z.enum(['quality', 'ats', 'impact', 'evidence']), label: z.string().max(80), score, weak: z.boolean().optional() })).length(4),
  strengths: z.array(z.string().max(220)).max(4),
  improvements: z.array(z.string().max(220)).max(4),
  evidence: z.array(z.object({ skill: z.string().max(60), level: z.enum(['kuat', 'cukup', 'kurang', 'belum']), note: z.string().max(300) })).max(6),
  qualityChecks: z.array(check).max(4), atsChecks: z.array(check).max(4),
  impactExamples: z.array(z.object({ before: z.string().max(300), after: z.string().max(300) })).max(2),
  fileName: z.string().min(1).max(255), analyzedAt: z.iso.datetime(),
});

type Db = ReturnType<typeof getDb>;
const columns = { id: cvScans.id, result: cvScans.result, createdAt: cvScans.createdAt };
const newest = [desc(cvScans.createdAt), desc(cvScans.id)];
const validRow = (row: { id: string; result: CvResult; createdAt: Date }) => ({ ...row, result: cvHistoryResultSchema.parse(row.result) });

/** Called only with a successful server analysis, never a client supplied result. */
export async function saveCvScan(userId: string, result: CvResult, db: Db = getDb()) {
  const validated = cvHistoryResultSchema.parse(result);
  return db.transaction(async (tx) => {
    // Serialize this owner's writes so concurrent scans cannot exceed retention.
    await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for('update');
    const [saved] = await tx.insert(cvScans).values({ userId, result: validated }).returning(columns);
    const expired = await tx.select({ id: cvScans.id }).from(cvScans).where(eq(cvScans.userId, userId)).orderBy(...newest).offset(CV_HISTORY_LIMIT);
    if (expired.length) await tx.delete(cvScans).where(and(eq(cvScans.userId, userId), inArray(cvScans.id, expired.map(row => row.id))));
    return validRow(saved);
  });
}

export async function listCvScans(userId: string, db: Db = getDb()) {
  const rows = await db.select(columns).from(cvScans).where(eq(cvScans.userId, userId)).orderBy(...newest).limit(CV_HISTORY_LIMIT);
  return rows.map(row => ({ id: row.id, createdAt: row.createdAt, fileName: row.result.fileName, score: row.result.score }));
}

export async function getCvScan(userId: string, id: string, db: Db = getDb()) {
  const [row] = await db.select(columns).from(cvScans).where(and(eq(cvScans.userId, userId), eq(cvScans.id, id))).limit(1);
  return row ? validRow(row) : null;
}

export async function getLatestCvScan(userId: string, db: Db = getDb()) {
  const [row] = await db.select(columns).from(cvScans).where(eq(cvScans.userId, userId)).orderBy(...newest).limit(1);
  return row ? validRow(row) : null;
}

export async function deleteCvScan(userId: string, id: string, db: Db = getDb()) {
  const deleted = await db.delete(cvScans).where(and(eq(cvScans.userId, userId), eq(cvScans.id, id))).returning({ id: cvScans.id });
  return deleted.length > 0;
}

export type CvSaveStatus = { status: 'not_requested' | 'sign_in_required' | 'failed' } | { status: 'saved'; id: string };

/** Persistence is deliberately best effort; scanning itself needs neither auth nor DB. */
export async function saveCompletedCvScan(result: CvResult, requested: boolean, deps = {
  getUser: async (): Promise<{ id: string } | null> => (await import('@/server/auth/session')).getCurrentUser(),
  save: async (userId: string, analysis: CvResult): Promise<{ id: string }> => saveCvScan(userId, analysis),
}): Promise<CvSaveStatus> {
  if (!requested) return { status: 'not_requested' };
  try {
    const user = await deps.getUser();
    if (!user) return { status: 'sign_in_required' };
    const saved = await deps.save(user.id, result);
    return { status: 'saved', id: saved.id };
  } catch {
    // Never log CV contents or turn an unavailable history DB into a failed scan.
    return { status: 'failed' };
  }
}
