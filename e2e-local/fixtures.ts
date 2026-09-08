/**
 * Fixture data for the sandbox browser suite.
 *
 * Raw SQL rather than the app's server modules, so the Playwright process never
 * imports `server-only` code. Everything it writes is prefixed with `E2EL-` and
 * removed again by the teardown, so a run leaves the sandbox as it found it.
 */
import { SignJWT } from "jose";
import postgres from "postgres";

export const PARTICIPANT_ID = "e2e-local-participant";
export const AUTH_SUBJECT = `sk-participant:${PARTICIPANT_ID}`;
export const ADMIN_ID = "local-sandbox-admin";
export const ADMIN_SUBJECT = `sk-participant:${ADMIN_ID}`;
export const PREFIX = "E2EL";
export const WEEK_CODE = `${PREFIX}-WEEK`;
export const FINALIZED_WEEK_CODE = `${PREFIX}-DONE`;
export const DIVISION_SLUG = `${PREFIX.toLowerCase()}-division`;
export const PROJECT_SLUG = `${PREFIX.toLowerCase()}-project`;
export const JOBS_SOURCE_SLUG = `${PREFIX.toLowerCase()}-jobs`;
export const SKILL_SLUG = `${PREFIX.toLowerCase()}-sql`;
/** What the app will actually display, because provisioning derives it from the token. */
export const DISPLAY_NAME_PARTICIPANT = "Peserta Lokal";
export const DISPLAY_NAME_ADMIN = "Admin Lokal";

export function connect(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) throw new Error("DATABASE_URL is required for the sandbox browser suite.");
  const url = new URL(databaseUrl);
  // The whole point of this suite is that it cannot reach a shared database.
  if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || url.pathname !== "/arena_local") {
    throw new Error("The sandbox browser suite only runs against the loopback arena_local database.");
  }
  return postgres(databaseUrl, { max: 1 });
}

type Sql = ReturnType<typeof connect>;

/** The same token shape the main site signs, so the app verifies it unchanged. */
export async function mintParticipantToken(subject: string): Promise<string> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is required: the app verifies the participant cookie with it.");
  // `firstName` becomes the provisioned display name (see
  // `provisionParticipant`), and provisioning overwrites whatever the fixture
  // wrote — so the token, not the seed row, decides what a page shows.
  return new SignJWT({
    sub: subject,
    email: `${subject}@example.test`,
    username: subject,
    firstName: subject === ADMIN_ID ? DISPLAY_NAME_ADMIN : DISPLAY_NAME_PARTICIPANT,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("4h")
    .sign(new TextEncoder().encode(secret));
}

export async function teardownFixture(sql: Sql) {
  const weeks = await sql`select id from arena.weeks where week_code like ${`${PREFIX}-%`}`;
  for (const week of weeks) {
    await sql`delete from arena.weekly_rankings where week_id = ${week.id}`;
    await sql`delete from arena.skill_evidence where week_id = ${week.id}`;
    await sql`delete from arena.review_scores where review_id in (
      select r.id from arena.reviews r join arena.submission_versions v on v.id = r.submission_version_id
      join arena.submissions s on s.id = v.submission_id where s.week_id = ${week.id})`;
    await sql`delete from arena.reviews where submission_version_id in (
      select v.id from arena.submission_versions v join arena.submissions s on s.id = v.submission_id where s.week_id = ${week.id})`;
    await sql`delete from arena.review_artifacts where submission_version_id in (
      select v.id from arena.submission_versions v join arena.submissions s on s.id = v.submission_id where s.week_id = ${week.id})`;
    await sql`delete from arena.review_jobs where submission_version_id in (
      select v.id from arena.submission_versions v join arena.submissions s on s.id = v.submission_id where s.week_id = ${week.id})`;
    await sql`delete from arena.submission_version_items where submission_version_id in (
      select v.id from arena.submission_versions v join arena.submissions s on s.id = v.submission_id where s.week_id = ${week.id})`;
    await sql`delete from arena.submission_versions where submission_id in (select id from arena.submissions where week_id = ${week.id})`;
    await sql`delete from arena.submission_draft_items where submission_id in (select id from arena.submissions where week_id = ${week.id})`;
    await sql`delete from arena.upload_intents where submission_id in (select id from arena.submissions where week_id = ${week.id})`;
    await sql`delete from arena.submissions where week_id = ${week.id}`;
    await sql`delete from arena.workspace_progress where enrollment_id in (select id from arena.enrollments where week_id = ${week.id})`;
    await sql`delete from arena.enrollments where week_id = ${week.id}`;
    await sql`delete from notifications.deliveries where event_id in (select id from notifications.events where week_id = ${week.id})`;
    await sql`delete from notifications.events where week_id = ${week.id}`;
    await sql`delete from rewards.point_ledger where week_id = ${week.id}`;
    await sql`delete from arena.project_rubric_criteria where project_id in (select id from arena.projects where week_id = ${week.id})`;
    await sql`delete from arena.project_submission_requirements where project_id in (select id from arena.projects where week_id = ${week.id})`;
    await sql`delete from arena.project_skills where project_id in (select id from arena.projects where week_id = ${week.id})`;
    await sql`delete from arena.projects where week_id = ${week.id}`;
    await sql`delete from arena.week_rules where week_id = ${week.id}`;
    await sql`delete from arena.weeks where id = ${week.id}`;
  }
  await sql`delete from arena.job_sources where slug = ${JOBS_SOURCE_SLUG}`;
  for (const subject of [AUTH_SUBJECT, ADMIN_SUBJECT]) {
    const [user] = await sql`select id from identity.users where auth_subject = ${subject}`;
    if (!user) continue;
    await sql`delete from arena.cv_scans where user_id = ${user.id}`;
    await sql`delete from rewards.point_ledger where user_id = ${user.id}`;
    await sql`delete from rewards.point_accounts where user_id = ${user.id}`;
    await sql`delete from notifications.deliveries where event_id in (select id from notifications.events where user_id = ${user.id})`;
    await sql`delete from notifications.events where user_id = ${user.id}`;
    await sql`delete from arena.upload_intents where user_id = ${user.id}`;
    await sql`delete from arena.skill_evidence where user_id = ${user.id}`;
    await sql`delete from identity.users where id = ${user.id}`;
  }
  await sql`delete from arena.skill_aliases where skill_id in (select id from arena.skills where slug = ${SKILL_SLUG})`;
  await sql`delete from arena.skills where slug = ${SKILL_SLUG}`;
  await sql`delete from arena.divisions where slug = ${DIVISION_SLUG}`;
}

/**
 * One open week with a live project, and one finalized week with a scored
 * result — so the suite can drive both "there is work to do" and "there are
 * results to read" without waiting for a real week to turn over.
 */
export async function setupFixture(sql: Sql) {
  await teardownFixture(sql);
  const now = new Date();

  const [division] = await sql`
    insert into arena.divisions (slug, name, description, is_active, sort_order)
    values (${DIVISION_SLUG}, ${"E2E Local Division"}, ${"Sandbox browser fixture"}, true, 9999) returning id`;
  const [skill] = await sql`
    insert into arena.skills (slug, name) values (${SKILL_SLUG}, ${"E2E Local SQL"}) returning id`;

  // `avatar_id` is set deliberately: a null one raises the one-time avatar
  // picker, a modal that covers the page and intercepts every click. Testing
  // through it would be testing the modal, not the page underneath.
  const [participant] = await sql`
    insert into identity.users (auth_subject, display_name_cache, email_cache, avatar_id)
    values (${AUTH_SUBJECT}, ${"Peserta Lokal"}, ${"peserta@example.test"}, ${"rocket"}) returning id`;
  const [admin] = await sql`
    insert into identity.users (auth_subject, display_name_cache, email_cache, avatar_id)
    values (${ADMIN_SUBJECT}, ${"Admin Lokal"}, ${"admin@example.test"}, ${"rocket"}) returning id`;

  // --- the open week -------------------------------------------------------
  const [openWeek] = await sql`
    insert into arena.weeks (week_code, title, status, opens_at, submission_deadline_at, timezone)
    values (${WEEK_CODE}, ${"Minggu uji lokal"}, 'OPEN', ${new Date(now.getTime() - 3600_000)},
            ${new Date(now.getTime() + 3 * 86_400_000)}, 'Asia/Jakarta') returning id`;
  await sql`insert into arena.week_rules (week_id, max_projects_per_user, max_review_attempts, allow_late_submission)
            values (${openWeek.id}, 1, 3, false)`;
  const [project] = await sql`
    insert into arena.projects (week_id, division_id, slug, title, short_description, case_background, role_description,
      mission, objective, status, published_at, estimated_minutes, difficulty)
    values (${openWeek.id}, ${division.id}, ${PROJECT_SLUG}, ${"Analisis margin kanal"},
      ${"Susun laporan margin per kanal dari data penjualan mentah."},
      ${"Jaringan ritel kehilangan visibilitas margin sejak menambah kanal daring."},
      ${"Kamu berperan sebagai analis data junior."},
      ${"Bersihkan data lalu hitung margin per kanal."},
      ${"Laporan margin yang bisa dipakai rapat mingguan."},
      'PUBLISHED', ${now}, 240, 'STANDARD') returning id`;
  await sql`insert into arena.project_skills (project_id, skill_id, weight) values (${project.id}, ${skill.id}, '1.00')`;
  await sql`insert into arena.project_submission_requirements (project_id, label, type, required, min_items, max_items, allowed_mime_types, instructions, sort_order)
            values (${project.id}, ${"Laporan analisis"}, 'FILE', true, 1, 1, ${sql.array(["text/csv"])}, ${"Unggah tabel margin sebagai CSV."}, 0)`;
  await sql`insert into arena.project_rubric_criteria (project_id, skill_id, name, description, weight, max_score, review_instruction, sort_order)
            values (${project.id}, ${skill.id}, ${"Ketepatan analisis"}, ${"Menilai ketepatan perhitungan margin."}, '1.00', '100', ${"Periksa perhitungan margin per kanal."}, 0)`;

  // --- a finalized week, so results and the career report have content -----
  const [doneWeek] = await sql`
    insert into arena.weeks (week_code, title, status, opens_at, submission_deadline_at, finalized_at, timezone)
    values (${FINALIZED_WEEK_CODE}, ${"Minggu selesai"}, 'FINALIZED', ${new Date(now.getTime() - 10 * 86_400_000)},
            ${new Date(now.getTime() - 4 * 86_400_000)},
            -- Finalized "just now" so this is unambiguously the latest week:
            -- the Showcase features exactly one week, and a seeded week from
            -- another fixture must not be the one under test.
            ${now}, 'Asia/Jakarta') returning id`;
  await sql`insert into arena.week_rules (week_id, max_projects_per_user, max_review_attempts, allow_late_submission)
            values (${doneWeek.id}, 1, 3, false)`;
  const [donePr] = await sql`
    insert into arena.projects (week_id, division_id, slug, title, short_description, status, published_at, estimated_minutes, difficulty)
    values (${doneWeek.id}, ${division.id}, ${`${PROJECT_SLUG}-done`}, ${"Dashboard operasional"},
      ${"Bangun dashboard operasional sederhana."}, 'PUBLISHED', ${new Date(now.getTime() - 10 * 86_400_000)}, 240, 'STANDARD') returning id`;
  await sql`insert into arena.project_skills (project_id, skill_id, weight) values (${donePr.id}, ${skill.id}, '1.00')`;
  const [criterion] = await sql`
    insert into arena.project_rubric_criteria (project_id, skill_id, name, description, weight, max_score, review_instruction, sort_order)
    values (${donePr.id}, ${skill.id}, ${"Kualitas dashboard"}, ${"Menilai kejelasan dashboard."}, '1.00', '100', ${"Periksa kejelasan visual dan angka."}, 0) returning id`;
  const [doneEnrollment] = await sql`
    insert into arena.enrollments (user_id, week_id, project_id, status)
    values (${participant.id}, ${doneWeek.id}, ${donePr.id}, 'COMPLETED') returning id`;
  const [doneSubmission] = await sql`
    insert into arena.submissions (enrollment_id, user_id, week_id, project_id, status)
    values (${doneEnrollment.id}, ${participant.id}, ${doneWeek.id}, ${donePr.id}, 'FINALIZED') returning id`;
  const [doneVersion] = await sql`
    insert into arena.submission_versions (submission_id, version_number, submitted_at, access_status, review_attempt_number, review_status)
    values (${doneSubmission.id}, 1, ${new Date(now.getTime() - 5 * 86_400_000)}, 'ACCESSIBLE', 1, 'COMPLETED') returning id`;
  const [review] = await sql`
    insert into arena.reviews (submission_version_id, run_number, status, ai_score, final_score, summary, reviewed_at, review_model, prompt_version)
    values (${doneVersion.id}, 1, 'COMPLETED_HIDDEN', '84.00', '84.00', ${"Dashboard rapi dan angkanya konsisten."},
            ${new Date(now.getTime() - 4 * 86_400_000)}, ${"fixture-model"}, ${"fixture"}) returning id`;
  await sql`insert into arena.review_scores (review_id, rubric_criterion_id, raw_score, max_score, weighted_score, evidence)
            values (${review.id}, ${criterion.id}, '84.00', '100.00', '84.00', ${sql.json(["[item] fixture evidence"])})`;
  await sql`insert into arena.weekly_rankings (week_id, user_id, project_id, submission_version_id, review_id, final_score, final_submitted_at, rank, points_awarded)
            values (${doneWeek.id}, ${participant.id}, ${donePr.id}, ${doneVersion.id}, ${review.id}, '84.00',
                    ${new Date(now.getTime() - 5 * 86_400_000)}, 1, 300)`;
  await sql`insert into arena.skill_evidence (user_id, week_id, project_id, review_id, skill_id, score, attribution, criterion_count, evidence_summary)
            values (${participant.id}, ${doneWeek.id}, ${donePr.id}, ${review.id}, ${skill.id}, '84.00', 'CRITERION', 1, ${"Dashboard rapi."})`;
  await sql`insert into rewards.point_accounts (user_id, balance, lifetime_earned, lifetime_spent)
            values (${participant.id}, 300, 300, 0)
            on conflict (user_id) do update set balance = 300, lifetime_earned = 300`;

  // --- a jobs source with one live opening ---------------------------------
  const [source] = await sql`
    insert into arena.job_sources (slug, name, adapter, config, is_active, sync_interval_minutes, staleness_days, last_successful_sync_at)
    values (${JOBS_SOURCE_SLUG}, ${"Sumber uji lokal"}, ${"fixture-file"},
            ${sql.json({ file: "scripts/fixtures/jobs-feed.json", pageSize: 3, maxPages: 5, fieldMap: {} })},
            true, 60, 3, ${now}) returning id`;
  const [opening] = await sql`
    insert into arena.job_openings (source_id, external_id, canonical_key, title, company, location, work_mode,
      employment_type, description, required_skills, preferred_skills, application_url, posted_at, status, content_hash,
      first_seen_at, last_seen_at, status_changed_at)
    values (${source.id}, ${"e2el-1"}, ${"e2el-canonical"}, ${"Junior Data Analyst"}, ${"Studio Contoh (fiktif)"}, ${"Jakarta"},
            'HYBRID', 'FULL_TIME', ${"Menyusun laporan margin per kanal."}, ${sql.array(["E2E Local SQL", "Skill Tak Terpetakan"])},
            ${sql.array([])}, ${"https://example.invalid/e2el-1"}, ${now}, 'OPEN', ${"hash-e2el-1"}, ${now}, ${now}, ${now}) returning id`;
  await sql`insert into arena.job_opening_skills (job_opening_id, skill_id, kind, matched_alias)
            values (${opening.id}, ${skill.id}, 'REQUIRED', ${"E2E Local SQL"})`;
  // A closed opening, to prove the participant view never shows one.
  await sql`insert into arena.job_openings (source_id, external_id, canonical_key, title, company, location, work_mode,
      employment_type, required_skills, preferred_skills, application_url, status, content_hash, first_seen_at, last_seen_at, status_changed_at)
    values (${source.id}, ${"e2el-closed"}, ${"e2el-canonical-closed"}, ${"Peran Sudah Ditutup"}, ${"Arsip Contoh (fiktif)"},
            ${"Bandung"}, 'REMOTE', 'CONTRACT', ${sql.array([])}, ${sql.array([])},
            ${"https://example.invalid/e2el-closed"}, 'CLOSED', ${"hash-e2el-closed"}, ${now}, ${now}, ${now})`;

  return { participantId: participant.id, adminId: admin.id, projectSlug: PROJECT_SLUG };
}
