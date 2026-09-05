// Database fixture for browser E2E. Uses raw SQL rather than the app's server
// modules so the Playwright process never pulls in `server-only` code.
//
// Sign-in is minted, not performed: the Arena verifies the Sekolah Karir
// participant cookie but cannot issue one, and the main site is a separate
// application. Signing this suite's own `sk_participant` with the shared
// SESSION_SECRET produces exactly what a real login hands the browser, so
// everything downstream of the cookie is the real path.
import { SignJWT } from "jose";
import postgres from "postgres";

export const PARTICIPANT_ID = "e2e-participant";
export const AUTH_SUBJECT = `sk-participant:${PARTICIPANT_ID}`;
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

/** The same token shape the main site signs, so the app verifies it unchanged. */
export async function mintParticipantToken(): Promise<string> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is required: the app verifies the participant cookie with it.");
  return new SignJWT({
    sub: PARTICIPANT_ID,
    email: "e2e@example.test",
    username: "e2erunner",
    firstName: "E2E",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(new TextEncoder().encode(secret));
}

export async function teardownFixture(sql: Sql) {
  // The app provisions this row itself on the first authenticated request, so
  // teardown finds it by subject rather than by an id the fixture invented.
  const [user] = await sql`select id from identity.users where auth_subject = ${AUTH_SUBJECT}`;
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


/**
 * Refuse to run beside another open week.
 *
 * The app resolves a single "current week", so a second OPEN row — the manual
 * QA fixture is the usual culprit — silently steals it, and the suite then
 * drives a workspace whose week is not the one it built. That surfaces as a
 * step that will not advance, which looks nothing like its cause.
 */
async function assertNoCompetingOpenWeek(sql: Sql) {
  const others = await sql`
    select week_code from arena.weeks where status = 'OPEN' and week_code <> ${WEEK_CODE}`;
  if (others.length === 0) return;
  const names = others.map((row) => row.week_code).join(", ");
  throw new Error(
    `Another Arena week is OPEN (${names}), so the app would treat it as the current week ` +
      `instead of the one this suite builds. Close or remove it first — if it is the manual QA ` +
      `fixture, run: node scripts/qa-session.tmp.mjs teardown`,
  );
}

export async function setupFixture(sql: Sql) {
  await teardownFixture(sql);
  await assertNoCompetingOpenWeek(sql);
  const now = new Date();

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

  return { token: await mintParticipantToken() };
}

/** Reset the user back to "enrolled in nothing" without rebuilding the week. */
export async function resetEnrollment(sql: Sql) {
  const [user] = await sql`select id from identity.users where auth_subject = ${AUTH_SUBJECT}`;
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

export async function getProjectId(sql: Sql) {
  const [project] = await sql`select id from arena.projects where slug = ${PROJECT_SLUG}`;
  if (!project) throw new Error("E2E fixture project is missing.");
  return project.id as string;
}
