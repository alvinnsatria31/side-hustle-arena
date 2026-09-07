import 'server-only';
import { getParticipantOverview } from '@/server/arena/participant-service';
import { getDb } from '@/server/db/client';
import { getLatestCvScan } from '@/server/cv/history';
import { buildCareerReport, type CvSummary } from './report';

/**
 * The CV is read best-effort. A participant who has never scanned one, or whose
 * scan cannot be read, still has a complete career report from Arena results —
 * the CV section is an addition to it, never a dependency of it.
 */
async function latestCv(userId: string, db: ReturnType<typeof getDb>): Promise<CvSummary | null> {
  try {
    const row = await getLatestCvScan(userId, db);
    if (!row) return null;
    return {
      score: row.result.score,
      statusLabel: row.result.statusLabel,
      fileName: row.result.fileName,
      analyzedAt: row.result.analyzedAt,
      evidence: row.result.evidence,
    };
  } catch {
    return null;
  }
}

export async function getCareerReport(userId: string, db = getDb()) {
  const [overview, cv] = await Promise.all([getParticipantOverview(userId, db), latestCv(userId, db)]);
  return buildCareerReport({ ...overview, cv });
}
