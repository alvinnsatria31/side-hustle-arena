// Database fixture for browser E2E. Uses raw SQL rather than the app's server
// modules so the Playwright process never pulls in `server-only` code.
//
// PLACEHOLDER (needs a decision from the repo owner): the session below is
// minted directly instead of going through the real SSO login, because the
// canonical auth server on :3000 is a separate codebase that does not run on
// this machine. Once canonical is reachable in CI, replace mintSession() with a
// real login and delete the keep-alive helper. See e2e/README.md.
import { createHash, randomBytes } from "node:crypto";
import postgres from "postgres";

export const SUBJECT = "e2e-arena-user";
export const WEEK_CODE = "E2E-ARENA";
export const DIVISION_SLUG = "e2e-arena-div";
export const PROJECT_SLUG = "e2e-arena-project";
export const PROJECT_TITLE = "E2E Upload Project";

export function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required for browser E2E.");
  if (process.env.APP_ENV !== "development") {
    throw new Error("Browser E2E only runs against APP_ENV=development.");
  }
  return postgres(url, { max: 1 });
}

type Sql = ReturnType<typeof connect>;

export async function teardownFixture(sql: Sql) {
  const [user] = await sql`select id from identity.users where auth_subject = ${SUBJECT}`;
  if (user) {
    const enrollments = await sql`select id from arena.enrollments where user_id = ${user.id}`;
    for (const enrollment of enrollments) {
      const submissions = await sql`select id from arena.submissions where enrollment_id = ${enrollment.id}`;
      for (const submission of submissions) {
        const versions = await sql`select id from arena.submission_versions where submission_id = ${submission.id}`;
        for (const version of versions) {
          await sql`delete from arena.review_jobs where submission_version_id = ${version.id}`;
          await sql`delete from arena.submission_version_items where submission_version_id = ${version.id}`;
        }
        await sql`delete from arena.submission_versions where submission_id = ${submission.id}`;
        await sql`delete from arena.submission_draft_items where submission_id = ${submission.id}`;
        await sql`delete from arena.upload_intents where submission_id = ${submission.id}`;
        await sql`delete from arena.submissions where id = ${submission.id}`;
      }
      await sql`delete from arena.workspace_progress where enrollment_id = ${enrollment.id}`;
      await sql`delete from arena.enrollments where id = ${enrollment.id}`;
    }
    await sql`delete from notifications.deliveries where event_id in (select id from notifications.events where user_id = ${user.id})`;
    await sql`delete from notifications.events where user_id = ${user.id}`;
    await sql`delete from identity.sessions where user_id = ${user.id}`;
    await sql`delete from identity.users where id = ${user.id}`;
  }
  const [project] = await sql`select id from arena.projects where slug = ${PROJECT_SLUG}`;
  if (project) {
    await sql`delete from arena.project_submission_requirements where project_id = ${project.id}`;
    await sql`delete from arena.projects where id = ${project.id}`;
  }
  await sql`delete from arena.divisions where slug = ${DIVISION_SLUG}`;
  const [week] = await sql`select id from arena.weeks where week_code = ${WEEK_CODE}`;
  if (week) {
    await sql`delete from arena.week_rules where week_id = ${week.id}`;
    await sql`delete from arena.weeks where id = ${week.id}`;
  }
}

export async function setupFixture(sql: Sql) {
  await teardownFixture(sql);
  const now = new Date();

  const [user] = await sql`
    insert into identity.users (auth_subject, email_cache, display_name_cache)
    values (${SUBJECT}, 'e2e@example.test', 'E2E Runner') returning id`;
  const token = randomBytes(32).toString("base64url");
  await sql`
    insert into identity.sessions (user_id, token_hash, canonical_grant_id, expires_at, last_canonical_check_at)
    values (${user.id}, ${createHash("sha256").update(token).digest("hex")}, ${`e2e-grant-${Date.now()}`},
            ${new Date(now.getTime() + 24 * 3600_000)}, now())`;

  const [week] = await sql`
    insert into arena.weeks (week_code, title, status, opens_at, submission_deadline_at, timezone)
    values (${WEEK_CODE}, 'E2E Arena Week', 'OPEN', ${new Date(now.getTime() - 3600_000)},
            ${new Date(now.getTime() + 24 * 3600_000)}, 'Asia/Jakarta') returning id`;
  await sql`
    insert into arena.week_rules (week_id, max_projects_per_user, max_review_attempts, allow_late_submission)
    values (${week.id}, 1, 3, false)`;
  const [division] = await sql`
    insert into arena.divisions (slug, name, description, is_active, sort_order)
    values (${DIVISION_SLUG}, 'E2E Division', 'browser e2e fixture', true, 0) returning id`;
  const [project] = await sql`
    insert into arena.projects (week_id, division_id, slug, title, short_description, status, published_at)
    values (${week.id}, ${division.id}, ${PROJECT_SLUG}, ${PROJECT_TITLE},
            'Fixture project for the browser end-to-end suite.', 'PUBLISHED', ${now}) returning id`;
  await sql`
    insert into arena.project_submission_requirements (project_id, label, type, required, min_items, max_items, instructions, sort_order)
    values (${project.id}, 'Deliverable files', 'FILE', false, 0, 5, 'Upload up to 5 files.', 0)`;
  await sql`
    insert into arena.project_submission_requirements (project_id, label, type, required, min_items, max_items, instructions, sort_order)
    values (${project.id}, 'Work links', 'LINK', false, 0, 5, 'Add up to 5 links.', 1)`;

  return { userId: user.id as string, token };
}

/** Reset the user back to "enrolled in nothing" without rebuilding the week. */
export async function resetEnrollment(sql: Sql) {
  const [user] = await sql`select id from identity.users where auth_subject = ${SUBJECT}`;
  if (!user) return;
  const enrollments = await sql`select id from arena.enrollments where user_id = ${user.id}`;
  for (const enrollment of enrollments) {
    const submissions = await sql`select id from arena.submissions where enrollment_id = ${enrollment.id}`;
    for (const submission of submissions) {
      const versions = await sql`select id from arena.submission_versions where submission_id = ${submission.id}`;
      for (const version of versions) {
        await sql`delete from arena.review_jobs where submission_version_id = ${version.id}`;
        await sql`delete from arena.submission_version_items where submission_version_id = ${version.id}`;
      }
      await sql`delete from arena.submission_versions where submission_id = ${submission.id}`;
      await sql`delete from arena.submission_draft_items where submission_id = ${submission.id}`;
      await sql`delete from arena.upload_intents where submission_id = ${submission.id}`;
      await sql`delete from arena.submissions where id = ${submission.id}`;
    }
    await sql`delete from arena.workspace_progress where enrollment_id = ${enrollment.id}`;
    await sql`delete from arena.enrollments where id = ${enrollment.id}`;
  }
}

/**
 * PLACEHOLDER SUPPORT: with canonical :3000 offline, getCurrentUser revokes the
 * session the first time revalidation is due. Pushing the checkpoint forward
 * keeps a run alive. Delete this once real SSO login is wired into E2E.
 */
export async function refreshSessionCheckpoint(sql: Sql) {
  await sql`
    update identity.sessions set last_canonical_check_at = now()
    where user_id = (select id from identity.users where auth_subject = ${SUBJECT})`;
}

export async function getProjectId(sql: Sql) {
  const [project] = await sql`select id from arena.projects where slug = ${PROJECT_SLUG}`;
  if (!project) throw new Error("E2E fixture project is missing.");
  return project.id as string;
}
