import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import nextEnv from '@next/env';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql as query } from 'drizzle-orm';
import { getCareerReport } from '../src/server/career/report-service.ts';

nextEnv.loadEnvConfig(process.cwd());

test('database report isolates owners, excludes sealed rankings and reverses voided evidence', async () => {
  assert.ok(['development', 'test'].includes(process.env.APP_ENV), 'Only a development/test database may receive fixtures');
  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  const rollback = new Error('ROLLBACK_CAREER_FIXTURE');
  const stamp = randomUUID();
  try {
    await drizzle({ client: sql }).transaction(async db => {
      const tx = (strings, ...values) => db.execute(query(strings, ...values.map(value => value instanceof Date ? value.toISOString() : value)));
      const [owner] = await tx`insert into identity.users (auth_subject) values (${`career-owner-${stamp}`}) returning id`;
      const [stranger] = await tx`insert into identity.users (auth_subject) values (${`career-other-${stamp}`}) returning id`;
      const [skill] = await tx`insert into arena.skills (slug, name) values (${`career-sql-${stamp}`}, 'SQL') returning id`;
      const [division] = await tx`insert into arena.divisions (slug, name) values (${`career-div-${stamp}`}, 'Data') returning id`;
      const fixtures = [];
      for (const [i, status] of ['FINALIZED', 'CLOSED'].entries()) {
        const [week] = await tx`insert into arena.weeks (week_code, title, status, opens_at, submission_deadline_at, finalized_at)
          values (${`CAREER-${i}-${stamp}`}, 'Career fixture', ${status}, now() - interval '14 days', now() - interval '7 days', ${status === 'FINALIZED' ? new Date() : null}) returning id`;
        const [project] = await tx`insert into arena.projects (week_id, division_id, slug, title, status) values (${week.id}, ${division.id}, ${`career-${i}-${stamp}`}, 'Career project', 'PUBLISHED') returning id`;
        const [enrollment] = await tx`insert into arena.enrollments (user_id, week_id, project_id, status) values (${owner.id}, ${week.id}, ${project.id}, 'SUBMITTED') returning id`;
        const [submission] = await tx`insert into arena.submissions (enrollment_id, user_id, week_id, project_id, status) values (${enrollment.id}, ${owner.id}, ${week.id}, ${project.id}, 'SUBMITTED') returning id`;
        const [version] = await tx`insert into arena.submission_versions (submission_id, version_number, submitted_at, access_status, review_status, is_final) values (${submission.id}, 1, now(), 'ACCESSIBLE', 'COMPLETED', true) returning id`;
        const score = i === 0 ? 72 : 99;
        const [review] = await tx`insert into arena.reviews (submission_version_id, status, final_score) values (${version.id}, 'PUBLISHED', ${score}) returning id`;
        await tx`insert into arena.weekly_rankings (week_id, user_id, project_id, submission_version_id, review_id, final_score, final_submitted_at, rank, points_awarded) values (${week.id}, ${owner.id}, ${project.id}, ${version.id}, ${review.id}, ${score}, now(), 1, 300)`;
        // CRITERION-attributed: a rubric criterion actually measured this
        // skill, so it carries a score. A PROJECT-attributed row is asserted
        // separately below, because the two must never be conflated.
        await tx`insert into arena.skill_evidence (user_id, week_id, project_id, review_id, skill_id, score, attribution, criterion_count, evidence_summary) values (${owner.id}, ${week.id}, ${project.id}, ${review.id}, ${skill.id}, ${score}, 'CRITERION', 2, 'private evidence')`;
        fixtures.push({ week, project, review, enrollment });
      }
      await tx`insert into rewards.point_ledger (user_id, amount, entry_type, idempotency_key) values (${owner.id}, 300, 'WEEKLY_RANK', ${stamp})`;
      const mine = await getCareerReport(owner.id, db);
      assert.equal(mine.projectsCompleted, 1);
      assert.equal(mine.averageScore, 72);
      assert.equal(mine.skills[0].score, 72);
      assert.equal(mine.skills[0].measuredCount, 1);
      assert.equal(mine.points.balance, 300);

      // A second skill on the same finalized project that NO criterion
      // measured. It is recorded — the participant did the work — but it must
      // not carry a score, or one project result would look like two findings.
      const [unmeasured] = await tx`insert into arena.skills (slug, name) values (${`career-comms-${stamp}`}, 'Communication') returning id`;
      await tx`insert into arena.skill_evidence (user_id, week_id, project_id, review_id, skill_id, score, attribution, criterion_count) values (${owner.id}, ${fixtures[0].week.id}, ${fixtures[0].project.id}, ${fixtures[0].review.id}, ${unmeasured.id}, 72, 'PROJECT', 0)`;
      const withUnmeasured = await getCareerReport(owner.id, db);
      const comms = withUnmeasured.skills.find(entry => entry.name === 'Communication');
      assert.ok(comms, 'the skill is still recorded as involved');
      assert.equal(comms.score, null, 'a skill nothing measured must show no score');
      assert.equal(comms.projectScore, 72, 'the project score stays available as context');
      assert.equal(comms.measuredCount, 0);
      const other = await getCareerReport(stranger.id, db);
      assert.equal(other.projectsCompleted, 0);
      assert.deepEqual(other.skills, []);
      assert.equal(other.points.balance, 0);
      // Actual voiding removes rankings; stale evidence alone must never count.
      await tx`delete from arena.weekly_rankings where week_id = ${fixtures[0].week.id}`;
      const afterVoid = await getCareerReport(owner.id, db);
      assert.equal(afterVoid.projectsCompleted, 0);
      assert.deepEqual(afterVoid.skills, []);
      throw rollback;
    }).catch(error => { if (error !== rollback) throw error; });
    const residual = await sql`select id from identity.users where auth_subject = ${`career-owner-${stamp}`}`;
    assert.equal(residual.length, 0, 'fixture transaction must be rolled back');
  } finally {
    await sql.end({ timeout: 5 });
  }
});
