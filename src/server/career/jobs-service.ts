import 'server-only';
import { and, count, desc, eq, gt, inArray, isNull, or } from 'drizzle-orm';
import { getDb } from '@/server/db/client';
import {
  jobOpeningSkills, jobOpenings, jobSources,
  skillEvidence, skills, weeklyRankings, weeks,
} from '@/server/db/schema';
import { PUBLISHED_WEEK_STATUSES } from '@/server/arena/published-weeks';
import { freshnessMinutes, sourceHealth, type SourceHealth } from './jobs/sync-core';
import {
  computeCoverage, filterOpenings, rankByCoverage, safeJobsPortalUrl,
  type CoverageResult, type JobSkillRef, type JobsFilters,
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
  /** One page of the openings that pass the filters, best coverage first. */
  jobs: JobsOverviewItem[];
  /** Visible openings with coverage above zero, regardless of filters or paging. */
  matchCount: number;
  /** The best-covered visible opening, regardless of filters or paging. */
  topMatch: { id: string; title: string; matchScore: number } | null;
  /** Every visible opening, counted in SQL — never the length of a page. */
  totalOpen: number;
  /** Visible openings that pass the filters. */
  totalMatching: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  /** Filter choices drawn from every visible opening, not only this page. */
  facets: { employmentTypes: string[]; workModes: string[]; locations: string[] };
  /** More openings are visible than one request scans; `totalOpen` stays exact. */
  truncated: boolean;
  portalUrl: string | null;
  generatedAt: Date;
}

/**
 * Which skills has this participant actually proven?
 *
 * Two gates, both deliberate. The evidence row must join to a surviving
 * `weekly_rankings` row — a voided enrollment deletes the ranking, so its
 * evidence stops counting — and the week's result must be published
 * (FINALIZED or ARCHIVED), because a result that is still sealed is not
 * evidence of anything yet. CV claims are excluded on purpose: a CV is what
 * someone says about themselves, and Jobs coverage is built only from
 * reviewed, finalized work.
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
    .where(and(eq(skillEvidence.userId, userId), inArray(weeks.status, [...PUBLISHED_WEEK_STATUSES])))
    .orderBy(skills.name);
}

/**
 * What a participant may be shown: OPEN, from an active source, and not past
 * its known deadline. The sync marks expired roles EXPIRED eventually, but a
 * deadline the database already holds must not wait for the next successful
 * run — between runs, or while a source is failing, it would be offered as live.
 */
function visibleOpenings(now: Date) {
  return and(
    eq(jobOpenings.status, 'OPEN'),
    eq(jobSources.isActive, true),
    or(isNull(jobOpenings.expiresAt), gt(jobOpenings.expiresAt, now)),
  );
}

export const JOBS_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 100;
/**
 * Coverage ranks every visible opening before search and paging, so the best
 * match is found wherever it sits. The scan is bounded so one request cannot
 * grow without limit; past it the response says `truncated`.
 */
const MAX_SCAN = 5000;

export async function getJobsOverview(
  userId: string,
  options: { db?: Db; now?: Date; filters?: JobsFilters; offset?: number; limit?: number } = {},
): Promise<JobsOverview> {
  const db = options.db ?? getDb();
  const now = options.now ?? new Date();
  const limit = Math.min(Math.max(Math.trunc(options.limit ?? JOBS_PAGE_SIZE), 1), MAX_PAGE_SIZE);
  const offset = Math.max(Math.trunc(options.offset ?? 0), 0);
  const visible = visibleOpenings(now);

  const [evidence, rows, totals, perSource, facetRows, sourceRows] = await Promise.all([
    finalizedEvidenceSkills(db, userId),
    db.select({
      id: jobOpenings.id, title: jobOpenings.title, company: jobOpenings.company, location: jobOpenings.location,
      workMode: jobOpenings.workMode, employmentType: jobOpenings.employmentType, applicationUrl: jobOpenings.applicationUrl,
      postedAt: jobOpenings.postedAt, expiresAt: jobOpenings.expiresAt, lastSeenAt: jobOpenings.lastSeenAt,
      salaryMin: jobOpenings.salaryMin, salaryMax: jobOpenings.salaryMax,
      salaryCurrency: jobOpenings.salaryCurrency, salaryPeriod: jobOpenings.salaryPeriod,
      requiredSkills: jobOpenings.requiredSkills, preferredSkills: jobOpenings.preferredSkills,
      sourceSlug: jobSources.slug, sourceName: jobSources.name,
    })
      .from(jobOpenings)
      .innerJoin(jobSources, eq(jobSources.id, jobOpenings.sourceId))
      .where(visible)
      .orderBy(desc(jobOpenings.postedAt), desc(jobOpenings.lastSeenAt), jobOpenings.id)
      .limit(MAX_SCAN + 1),
    db.select({ total: count() })
      .from(jobOpenings)
      .innerJoin(jobSources, eq(jobSources.id, jobOpenings.sourceId))
      .where(visible),
    db.select({ slug: jobSources.slug, open: count() })
      .from(jobOpenings)
      .innerJoin(jobSources, eq(jobSources.id, jobOpenings.sourceId))
      .where(visible)
      .groupBy(jobSources.slug),
    db.selectDistinct({ employmentType: jobOpenings.employmentType, workMode: jobOpenings.workMode, location: jobOpenings.location })
      .from(jobOpenings)
      .innerJoin(jobSources, eq(jobSources.id, jobOpenings.sourceId))
      .where(visible),
    db.select().from(jobSources).where(eq(jobSources.isActive, true)).orderBy(jobSources.slug),
  ]);

  const truncated = rows.length > MAX_SCAN;
  const scanned = truncated ? rows.slice(0, MAX_SCAN) : rows;
  const evidenceIds = new Set(evidence.map((row) => row.id));

  // Joined on visibility rather than an IN list of ids: thousands of openings
  // would otherwise mean thousands of bind parameters.
  const skillRows = scanned.length
    ? await db.select({
        jobOpeningId: jobOpeningSkills.jobOpeningId,
        skillId: jobOpeningSkills.skillId,
        kind: jobOpeningSkills.kind,
        name: skills.name,
      })
      .from(jobOpeningSkills)
      .innerJoin(skills, eq(skills.id, jobOpeningSkills.skillId))
      .innerJoin(jobOpenings, eq(jobOpenings.id, jobOpeningSkills.jobOpeningId))
      .innerJoin(jobSources, eq(jobSources.id, jobOpenings.sourceId))
      .where(visible)
    : [];
  const byOpening = new Map<string, JobSkillRef[]>();
  for (const row of skillRows) {
    const list = byOpening.get(row.jobOpeningId) ?? [];
    list.push({ skillId: row.skillId, name: row.name, kind: row.kind });
    byOpening.set(row.jobOpeningId, list);
  }

  const jobs: JobsOverviewItem[] = scanned.map((opening) => {
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
      sourceSlug: opening.sourceSlug,
      sourceName: opening.sourceName,
      lastSeenAt: opening.lastSeenAt,
      ...coverage,
    };
  });

  const ranked = rankByCoverage(jobs);
  const filtered = filterOpenings(ranked, options.filters ?? {});
  const top = ranked.find((job) => (job.matchScore ?? 0) > 0);
  const openCounts = new Map(perSource.map((row) => [row.slug, row.open]));
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
    jobs: filtered.slice(offset, offset + limit),
    matchCount: ranked.filter((job) => (job.matchScore ?? 0) > 0).length,
    topMatch: top ? { id: top.id, title: top.title, matchScore: top.matchScore! } : null,
    totalOpen: totals[0]?.total ?? 0,
    totalMatching: filtered.length,
    offset,
    limit,
    hasMore: offset + limit < filtered.length,
    facets: {
      employmentTypes: [...new Set(facetRows.map((row) => row.employmentType))].sort(),
      workModes: [...new Set(facetRows.map((row) => row.workMode))].sort(),
      locations: [...new Set(facetRows.map((row) => row.location).filter((value): value is string => Boolean(value)))]
        .sort((left, right) => left.localeCompare(right)),
    },
    truncated,
    portalUrl: safeJobsPortalUrl(process.env.JOBS_PORTAL_URL),
    generatedAt: now,
  };
}
