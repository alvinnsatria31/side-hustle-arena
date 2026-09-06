import 'server-only';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/server/db/client';
import { skillEvidence, skills, weeklyRankings, weeks } from '@/server/db/schema';
import { JOBS_SOURCE_LABEL, SAMPLE_JOBS, matchJobs, safeJobsPortalUrl, type JobsOverview } from './jobs-matching';

/** The ranking's review is the selected final review, including any audited rerun. */
export async function getJobsOverview(userId: string): Promise<JobsOverview> {
  const rows = await getDb().selectDistinct({ name: skills.name })
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
  const names = rows.map(row => row.name);
  const jobs = matchJobs(SAMPLE_JOBS, names);
  return {
    source: 'hardcoded', sourceLabel: JOBS_SOURCE_LABEL, skills: names, jobs,
    matchCount: jobs.filter(job => (job.matchScore ?? 0) > 0).length,
    portalUrl: safeJobsPortalUrl(process.env.JOBS_PORTAL_URL),
  };
}
