import 'server-only';
import { getParticipantOverview } from '@/server/arena/participant-service';
import { getDb } from '@/server/db/client';
import { getLatestCvScan } from '@/server/cv/history';
import { skillAliases, skills } from '@/server/db/schema';
import { buildSkillIndex } from './skill-taxonomy';
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

/**
 * The shared taxonomy, so a CV claim and an Arena skill are compared with the
 * same vocabulary Jobs uses. Read best-effort for the same reason the CV is: a
 * taxonomy read that fails degrades the CV/Arena join to exact-name matching
 * rather than taking down the whole report.
 */
async function skillResolver(db: ReturnType<typeof getDb>) {
  try {
    const [skillRows, aliasRows] = await Promise.all([
      db.select({ id: skills.id, name: skills.name, slug: skills.slug }).from(skills),
      db.select({ skillId: skillAliases.skillId, alias: skillAliases.alias }).from(skillAliases),
    ]);
    const index = buildSkillIndex(skillRows, aliasRows);
    return (name: string) => index.resolve(name);
  } catch {
    return () => null;
  }
}

export async function getCareerReport(userId: string, db = getDb()) {
  const [overview, cv, resolveSkill] = await Promise.all([
    getParticipantOverview(userId, db),
    latestCv(userId, db),
    skillResolver(db),
  ]);
  return buildCareerReport({ ...overview, cv, resolveSkill });
}
