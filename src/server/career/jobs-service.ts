import 'server-only';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { getDb } from '@/server/db/client';
import {
  jobOpeningSkills, jobOpenings, jobSources,
  skillEvidence, skills, weeklyRankings, weeks,
} from '@/server/db/schema';
import { freshnessMinutes, sourceHealth, type SourceHealth } from './jobs/sync-core';
import {
  computeCoverage, rankByCoverage, safeJobsPortalUrl,
  type CoverageResult, type JobSkillRef,
} from './jobs/matching-core';

type Db = ReturnType<typeof getDb>;

export interface JobsOverviewItem extends CoverageResult {
  id: string;
  title: string;
  company: string;
  location: string | null;
  workMode: string;
  employmentType: string;
  applicationUrl: string;
  postedAt: Date | null;
  expiresAt: Date | null;
  salary: { min: number | null; max: number | null; currency: string | null; period: string | null } | null;
  skills: JobSkillRef[];
  unresolvedSkills: string[];
  sourceSlug: string;
  sourceName: string;
  lastSeenAt: Date;
}

export interface JobsOverview {
  /** 'live' once a real source has synced; 'empty' when nothing is connected. */
  source: 'live' | 'empty';
  sourceLabel: string;
  sources: Array<{
    slug: string; name: string; health: SourceHealth;
    lastSuccessfulSyncAt: Date | null; freshnessMinutes: number | null; openOpenings: number;
  }>;
  skills: string[];
  jobs: JobsOverviewItem[];
  matchCount: number;
  totalOpen: number;
  portalUrl: string | null;
  generatedAt: Date;
}

/**
 * Which skills has this participant actually proven?
 *
 * Two gates, both deliberate. The evidence row must join to a surviving
 * `weekly_rankings` row — a voided enrollment deletes the ranking, so its
 * evidence stops counting — and the week must be FINALIZED, because a result
 * that is still sealed is not evidence of anything yet. CV claims are excluded
 * on purpose: a CV is what someone says about themselves, and Jobs coverage is
 * built only from reviewed, finalized work.
 */
async function finalizedEvidenceSkills(db: Db, userId: string) {
  return db.selectDistinct({ id: skills.id, name: skills.name })
    .from(skillEvidence)
    .innerJoin(skills, eq(skills.id, skillEvidence.skillId))
    .innerJoin(weeklyRankings, and(
      eq(weeklyRankings.reviewId, skillEvidence.reviewId),
      eq(weeklyRankings.userId, skillEvidence.userId),
      eq(weeklyRankings.weekId, skillEvidence.weekId),
      eq(weeklyRankings.projectId, skillEvidence.projectId),
    ))
    .innerJoin(weeks, eq(weeks.id, weeklyRankings.weekId))
    .where(and(eq(skillEvidence.userId, userId), eq(weeks.status, 'FINALIZED')))
    .orderBy(skills.name);
}

const MAX_OPENINGS = 200;

export async function getJobsOverview(userId: string, options: { db?: Db; now?: Date } = {}): Promise<JobsOverview> {
  const db = options.db ?? getDb();
  const now = options.now ?? new Date();

  const evidence = await finalizedEvidenceSkills(db, userId);
  const evidenceIds = new Set(evidence.map((row) => row.id));

  // Only OPEN openings from active sources are recommendable. An expired,
  // stale or closed role stays in the database for history and for the admin
  // view, and never reaches a participant as if it were live.
  const rows = await db.select({
    opening: jobOpenings,
    sourceSlug: jobSources.slug,
    sourceName: jobSources.name,
  })
    .from(jobOpenings)
    .innerJoin(jobSources, eq(jobSources.id, jobOpenings.sourceId))
    .where(and(eq(jobOpenings.status, 'OPEN'), eq(jobSources.isActive, true)))
    .orderBy(desc(jobOpenings.postedAt), desc(jobOpenings.lastSeenAt))
    .limit(MAX_OPENINGS);

  const openingIds = rows.map((row) => row.opening.id);
  const skillRows = openingIds.length
    ? await db.select({
        jobOpeningId: jobOpeningSkills.jobOpeningId,
        skillId: jobOpeningSkills.skillId,
        kind: jobOpeningSkills.kind,
        name: skills.name,
      })
      .from(jobOpeningSkills)
      .innerJoin(skills, eq(skills.id, jobOpeningSkills.skillId))
      .where(inArray(jobOpeningSkills.jobOpeningId, openingIds))
    : [];
  const byOpening = new Map<string, JobSkillRef[]>();
  for (const row of skillRows) {
    const list = byOpening.get(row.jobOpeningId) ?? [];
    list.push({ skillId: row.skillId, name: row.name, kind: row.kind });
    byOpening.set(row.jobOpeningId, list);
  }

  const jobs: JobsOverviewItem[] = rows.map(({ opening, sourceSlug, sourceName }) => {
    const resolved = byOpening.get(opening.id) ?? [];
    const resolvedNames = new Set(resolved.map((skill) => skill.name.toLowerCase()));
    const unresolved = [...opening.requiredSkills, ...opening.preferredSkills]
      .filter((name) => !resolvedNames.has(name.toLowerCase()));
    const coverage = computeCoverage({ id: opening.id, skills: resolved, unresolvedSkills: unresolved }, evidenceIds);
    return {
      id: opening.id,
      title: opening.title,
      company: opening.company,
      location: opening.location,
      workMode: opening.workMode,
      employmentType: opening.employmentType,
      applicationUrl: opening.applicationUrl,
      postedAt: opening.postedAt,
      expiresAt: opening.expiresAt,
      salary: opening.salaryMin != null || opening.salaryMax != null
        ? { min: opening.salaryMin, max: opening.salaryMax, currency: opening.salaryCurrency, period: opening.salaryPeriod }
        : null,
      skills: resolved,
      unresolvedSkills: unresolved,
      sourceSlug,
      sourceName,
      lastSeenAt: opening.lastSeenAt,
      ...coverage,
    };
  });

  const sourceRows = await db.select().from(jobSources).where(eq(jobSources.isActive, true)).orderBy(jobSources.slug);
  const openCounts = new Map<string, number>();
  for (const job of jobs) openCounts.set(job.sourceSlug, (openCounts.get(job.sourceSlug) ?? 0) + 1);

  const ranked = rankByCoverage(jobs);
  return {
    source: sourceRows.length ? 'live' : 'empty',
    sourceLabel: sourceRows.length
      ? `Lowongan dari ${sourceRows.length} sumber terhubung`
      : 'Belum ada sumber lowongan terhubung — daftar masih kosong',
    sources: sourceRows.map((row) => ({
      slug: row.slug, name: row.name,
      health: sourceHealth(row, now),
      lastSuccessfulSyncAt: row.lastSuccessfulSyncAt,
      freshnessMinutes: freshnessMinutes(row.lastSuccessfulSyncAt, now),
      openOpenings: openCounts.get(row.slug) ?? 0,
    })),
    skills: evidence.map((row) => row.name),
    jobs: ranked,
    matchCount: ranked.filter((job) => (job.matchScore ?? 0) > 0).length,
    totalOpen: ranked.length,
    portalUrl: safeJobsPortalUrl(process.env.JOBS_PORTAL_URL),
    generatedAt: now,
  };
}
