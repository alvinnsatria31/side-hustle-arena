// TEMPORARY manual-QA helper. Not part of the test suite; delete when done.
//
//   node scripts/qa-session.tmp.mjs setup      -> build fixture, print the login line
//   node scripts/qa-session.tmp.mjs teardown   -> remove everything it created
//
// Exists because signing in happens on sekolah-karir-website, a separate app
// that does not run on this machine, and because the seeded dev projects carry
// no FILE requirement to upload against.
//
// No keep-alive: the Arena holds no session row of its own, so the minted
// cookie simply lives until it expires. Run setup and close the terminal.
import nextEnv from "@next/env";
import postgres from "postgres";
import { SignJWT } from "jose";

nextEnv.loadEnvConfig(process.cwd());
const sql = postgres(process.env.DATABASE_URL, { max: 1 });

const PARTICIPANT_ID = "qa-manual";
const AUTH_SUBJECT = `sk-participant:${PARTICIPANT_ID}`;
const WEEK_CODE = "QA-MANUAL";
const DIVISION_SLUG = "qa-manual-div";
const PROJECT_SLUG = "qa-manual-project";
const ORIGIN = process.env.ARENA_ORIGIN ?? "http://localhost:3001";

async function teardown({ quiet = false } = {}) {
  const [user] = await sql`select id from identity.users where auth_subject = ${AUTH_SUBJECT}`;
  if (user) {
    const enrollments = await sql`select id from arena.enrollments where user_id = ${user.id}`;
    for (const e of enrollments) {
      const subs = await sql`select id from arena.submissions where enrollment_id = ${e.id}`;
      for (const s of subs) {
        const versions = await sql`select id from arena.submission_versions where submission_id = ${s.id}`;
        for (const v of versions) {
          await sql`delete from arena.review_jobs where submission_version_id = ${v.id}`;
          await sql`delete from arena.submission_version_items where submission_version_id = ${v.id}`;
        }
        await sql`delete from arena.submission_versions where submission_id = ${s.id}`;
        await sql`delete from arena.submission_draft_items where submission_id = ${s.id}`;
        await sql`delete from arena.upload_intents where submission_id = ${s.id}`;
        await sql`delete from arena.submissions where id = ${s.id}`;
      }
      await sql`delete from arena.workspace_progress where enrollment_id = ${e.id}`;
      await sql`delete from arena.enrollments where id = ${e.id}`;
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
  if (!quiet) console.log("QA fixture removed. The seeded DEV week is untouched.");
}

async function setup() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is missing from .env — the app verifies the participant cookie with it.");

  await teardown({ quiet: true });
  const now = new Date();

  const [week] = await sql`
    insert into arena.weeks (week_code, title, status, opens_at, submission_deadline_at, timezone)
    values (${WEEK_CODE}, 'QA Manual Week', 'OPEN', ${new Date(now.getTime() - 3600_000)},
            ${new Date(now.getTime() + 3 * 24 * 3600_000)}, 'Asia/Jakarta') returning id`;
  await sql`
    insert into arena.week_rules (week_id, max_projects_per_user, max_review_attempts, allow_late_submission)
    values (${week.id}, 1, 3, false)`;
  const [division] = await sql`
    insert into arena.divisions (slug, name, description, is_active, sort_order)
    values (${DIVISION_SLUG}, 'QA Manual', 'manual QA fixture', true, 0) returning id`;
  const [project] = await sql`
    insert into arena.projects (week_id, division_id, slug, title, short_description, status, published_at)
    values (${week.id}, ${division.id}, ${PROJECT_SLUG}, 'QA Upload Project',
            'Fixture for manually testing the file upload flow.', 'PUBLISHED', ${now}) returning id`;
  await sql`
    insert into arena.project_submission_requirements (project_id, label, type, required, min_items, max_items, instructions, sort_order)
    values (${project.id}, 'Deliverable files', 'FILE', false, 0, 5, 'Upload up to 5 files.', 0)`;
  await sql`
    insert into arena.project_submission_requirements (project_id, label, type, required, min_items, max_items, instructions, sort_order)
    values (${project.id}, 'Work links', 'LINK', false, 0, 5, 'Add up to 5 links.', 1)`;

  // The same token shape sekolah-karir-website signs, so the app verifies it
  // exactly as it would a real login.
  const token = await new SignJWT({
    sub: PARTICIPANT_ID,
    email: "qa@example.test",
    username: "qamanual",
    firstName: "QA",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(new TextEncoder().encode(secret));

  console.log(`
=========================================================================
 QA fixture ready. Session valid for 12 hours — no terminal to keep open.

 1. Open:      ${ORIGIN}/arena
    (public page; do NOT open /app first or you get bounced to the login)

 2. DevTools console (F12), paste this ONE line:

      document.cookie = "sk_participant=${token}; path=/"

 3. Check you are in — paste this address:

      ${ORIGIN}/api/arena/enrollments/current

    {"data":null} = signed in, not enrolled yet.  UNAUTHORIZED = try again.

 4. Then go to: ${ORIGIN}/app/arena/projects
    Look for "QA Upload Project" in the QA Manual division.

 Clean up when finished:

      node scripts/qa-session.tmp.mjs teardown
=========================================================================
`);
}

const mode = process.argv[2];
try {
  if (mode === "teardown") await teardown();
  else if (mode === "setup") await setup();
  else {
    console.error("usage: node scripts/qa-session.tmp.mjs setup|teardown");
    process.exitCode = 1;
  }
} finally {
  await sql.end({ timeout: 5 });
}
