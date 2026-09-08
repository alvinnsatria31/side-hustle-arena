import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { after } from 'node:test';
import nextEnv from '@next/env';
import postgres from 'postgres';
import { getJobsOverview } from '../src/server/career/jobs-service.ts';

nextEnv.loadEnvConfig(process.cwd());
assert.ok(['development', 'test'].includes(process.env.APP_ENV), 'Jobs fixtures require a non-production database');
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
after(() => sql.end({ timeout: 5 }));

/**
 * Evidence selection, against a real database.
 *
 * The catalog assertions this suite used to carry are gone with the catalog —
 * openings now come from `arena.job_openings` and are covered by
 * `scripts/jobs-pipeline-integration.test.mjs`. What remains here is the part
 * that is specifically about whose evidence counts, which is the rule most
 * likely to be broken silently by a future join.
 */
test('Jobs uses only own evidence from the ranking-selected review in FINALIZED weeks', async (t) => {
  const stamp = randomUUID();
  const userIds = [], weekIds = [], projectIds = [], skillIds = [], reviewIds = [], versionIds = [], submissionIds = [], enrollmentIds = [];
  let divisionId;
  t.after(async () => {
    for (const id of weekIds) {
      await sql`delete from arena.skill_evidence where week_id = ${id}`;
      await sql`delete from arena.weekly_rankings where week_id = ${id}`;
    }
    for (const id of reviewIds) await sql`delete from arena.reviews where id = ${id}`;
    for (const id of versionIds) await sql`delete from arena.submission_versions where id = ${id}`;
    for (const id of submissionIds) await sql`delete from arena.submissions where id = ${id}`;
    for (const id of enrollmentIds) await sql`delete from arena.enrollments where id = ${id}`;
    for (const id of projectIds) await sql`delete from arena.projects where id = ${id}`;
    for (const id of skillIds) await sql`delete from arena.skills where id = ${id}`;
    if (divisionId) await sql`delete from arena.divisions where id = ${divisionId}`;
    for (const id of weekIds) await sql`delete from arena.weeks where id = ${id}`;
    for (const id of userIds) await sql`delete from identity.users where id = ${id}`;
  });

  for (let i = 0; i < 3; i++) {
    const [user] = await sql`insert into identity.users (auth_subject) values (${`jobs-${stamp}-${i}`}) returning id`;
    userIds.push(user.id);
  }
  const [division] = await sql`insert into arena.divisions (slug, name) values (${`jobs-${stamp}`}, 'Jobs fixture') returning id`;
  divisionId = division.id;

  for (const [index, status] of ['FINALIZED', 'CLOSED'].entries()) {
    const [week] = await sql`insert into arena.weeks (week_code, title, status, opens_at, submission_deadline_at)
      values (${`JOBS-${stamp}-${index}`}, 'Jobs fixture', ${status}, now() - interval '8 days', now() - interval '1 day') returning id`;
    weekIds.push(week.id);
    const [project] = await sql`insert into arena.projects (week_id, division_id, slug, title)
      values (${week.id}, ${divisionId}, ${`jobs-${stamp}-${index}`}, 'Jobs fixture') returning id`;
    projectIds.push(project.id);

    for (const [userIndex, userId] of userIds.slice(0, 2).entries()) {
      const [enrollment] = await sql`insert into arena.enrollments (user_id, week_id, project_id)
        values (${userId}, ${week.id}, ${project.id}) returning id`;
      enrollmentIds.push(enrollment.id);
      const [submission] = await sql`insert into arena.submissions (enrollment_id, user_id, week_id, project_id)
        values (${enrollment.id}, ${userId}, ${week.id}, ${project.id}) returning id`;
      submissionIds.push(submission.id);
      const [version] = await sql`insert into arena.submission_versions (submission_id, version_number, submitted_at, is_final)
        values (${submission.id}, 1, now(), true) returning id`;
      versionIds.push(version.id);

      for (let run = 1; run <= 2; run++) {
        const [review] = await sql`insert into arena.reviews (submission_version_id, run_number, status, final_score)
          values (${version.id}, ${run}, 'PUBLISHED', 80) returning id`;
        reviewIds.push(review.id);
        const name = index === 0 && userIndex === 0 && run === 2 ? 'SQL' : `excluded-${index}-${userIndex}-${run}`;
        const [skill] = await sql`insert into arena.skills (slug, name) values (${`jobs-${stamp}-${index}-${userIndex}-${run}`}, ${name}) returning id`;
        skillIds.push(skill.id);
        await sql`insert into arena.skill_evidence (user_id, week_id, project_id, review_id, skill_id, score)
          values (${userId}, ${week.id}, ${project.id}, ${review.id}, ${skill.id}, 80)`;
        if (run === 2) await sql`insert into arena.weekly_rankings
          (week_id, user_id, project_id, submission_version_id, review_id, final_score, final_submitted_at, rank, points_awarded)
          values (${week.id}, ${userId}, ${project.id}, ${version.id}, ${review.id}, 80, now(), ${userIndex + 1}, 100)`;
      }
    }
  }

  const result = await getJobsOverview(userIds[0]);
  // Only this user's own evidence, only from the ranking-selected review, only
  // from FINALIZED weeks. The `excluded-*` skills exist precisely so a leak
  // from another user, another run or a CLOSED week would show up by name.
  assert.deepEqual(result.skills, ['SQL']);
  assert.equal(JSON.stringify(result).includes('excluded-'), false);

  // Openings come from the database now; the hardcoded catalog is gone.
  assert.equal(JSON.stringify(result).includes('sample-data'), false);
  assert.ok(['live', 'empty'].includes(result.source));
  for (const job of result.jobs) {
    assert.ok(job.sourceSlug, 'every opening must name the source it came from');
    assert.match(job.applicationUrl, /^https:\/\//);
  }
  assert.ok(result.matchCount <= result.jobs.length);
  assert.equal(result.totalOpen, result.jobs.length);

  const empty = await getJobsOverview(userIds[2]);
  assert.deepEqual(empty.skills, []);
  assert.equal(empty.matchCount, 0);
  // No evidence means no score — with a stated reason, never a zero.
  assert.ok(empty.jobs.every(job => job.matchScore === null));
  assert.ok(empty.jobs.every(job => ['NO_EVIDENCE', 'NO_SKILL_DATA'].includes(job.unscoredReason)));
});
