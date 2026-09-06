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
export const REWARD_SLUG = "e2e-browser-reward";

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
          const reviews = await sql`select id from arena.reviews where submission_version_id = ${version.id}`;
          for (const review of reviews) {
            await sql`delete from arena.review_scores where review_id = ${review.id}`;
            await sql`delete from arena.review_overrides where review_id = ${review.id}`;
            await sql`delete from arena.skill_evidence where review_id = ${review.id}`;
            await sql`delete from audit.logs where entity_id = ${review.id}`;
          }
          await sql`delete from arena.weekly_rankings where submission_version_id = ${version.id}`;
          await sql`delete from arena.reviews where submission_version_id = ${version.id}`;
          await sql`delete from arena.review_jobs where submission_version_id = ${version.id}`;
          await sql`delete from arena.review_artifacts where submission_version_id = ${version.id}`;
          await sql`delete from audit.logs where entity_id = ${version.id}`;
          await sql`delete from arena.submission_version_items where submission_version_id = ${version.id}`;
        }
        await sql`delete from arena.submission_versions where submission_id = ${submission.id}`;
        await sql`delete from arena.submission_draft_items where submission_id = ${submission.id}`;
        await sql`delete from arena.upload_intents where submission_id = ${submission.id}`;
        await sql`delete from arena.submissions where id = ${submission.id}`;
      }
      await sql`delete from arena.workspace_progress where enrollment_id = ${enrollment.id}`;
      await sql`delete from audit.logs where entity_id = ${enrollment.id}`;
      await sql`delete from arena.enrollments where id = ${enrollment.id}`;
    }
    await sql`delete from notifications.deliveries where event_id in (select id from notifications.events where user_id = ${user.id})`;
    await sql`delete from notifications.events where user_id = ${user.id}`;
    await sql`delete from rewards.redemptions where user_id = ${user.id}`;
    await sql`delete from rewards.point_ledger where user_id = ${user.id}`;
    await sql`delete from rewards.point_accounts where user_id = ${user.id}`;
    await sql`delete from identity.sessions where user_id = ${user.id}`;
    await sql`delete from identity.users where id = ${user.id}`;
  }
  const [reward] = await sql`select id from rewards.catalog where slug = ${REWARD_SLUG}`;
  if (reward) {
    await sql`delete from rewards.redemptions where reward_id = ${reward.id}`;
    await sql`delete from rewards.inventory_periods where reward_id = ${reward.id}`;
    await sql`delete from rewards.catalog where id = ${reward.id}`;
  }
  const [project] = await sql`select id from arena.projects where slug = ${PROJECT_SLUG}`;
  if (project) {
    await sql`delete from arena.project_rubric_criteria where project_id = ${project.id}`;
    await sql`delete from arena.project_submission_requirements where project_id = ${project.id}`;
    await sql`delete from arena.projects where id = ${project.id}`;
  }
  await sql`delete from arena.divisions where slug = ${DIVISION_SLUG}`;
  const [week] = await sql`select id from arena.weeks where week_code = ${WEEK_CODE}`;
  if (week) {
    await sql`delete from notifications.deliveries where event_id in (select id from notifications.events where week_id = ${week.id})`;
    await sql`delete from notifications.events where week_id = ${week.id}`;
    await sql`delete from rewards.point_ledger where week_id = ${week.id}`;
    await sql`delete from arena.weekly_rankings where week_id = ${week.id}`;
    await sql`delete from audit.logs where entity_id = ${week.id}`;
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
  await sql`
    insert into arena.project_rubric_criteria (project_id, name, description, weight, max_score, sort_order)
    values (${project.id}, 'Execution', 'Browser E2E rubric fixture.', 1, 100, 0)`;

  // Teardown dropped the participant row and the app would rebuild it on the
  // first authenticated request — with no avatar, which is exactly what raises
  // the arrival picker. That modal is deliberately not dismissable, so it would
  // sit over every `/app` page and every spec here would fail on a click that
  // never lands. Creating the row up front makes this fixture an established
  // participant; `provisionParticipant` only refreshes the cached profile and
  // leaves the avatar alone. First arrival is covered on purpose in
  // avatar-picker.spec.ts, which clears the column itself.
  await ensureUser(sql);

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
        const reviews = await sql`select id from arena.reviews where submission_version_id = ${version.id}`;
        for (const review of reviews) {
          await sql`delete from arena.review_scores where review_id = ${review.id}`;
          await sql`delete from arena.review_overrides where review_id = ${review.id}`;
          await sql`delete from arena.skill_evidence where review_id = ${review.id}`;
          await sql`delete from audit.logs where entity_id = ${review.id}`;
        }
        await sql`delete from arena.weekly_rankings where submission_version_id = ${version.id}`;
        await sql`delete from arena.reviews where submission_version_id = ${version.id}`;
        await sql`delete from arena.review_jobs where submission_version_id = ${version.id}`;
        await sql`delete from arena.review_artifacts where submission_version_id = ${version.id}`;
        await sql`delete from audit.logs where entity_id = ${version.id}`;
        await sql`delete from arena.submission_version_items where submission_version_id = ${version.id}`;
      }
      await sql`delete from arena.submission_versions where submission_id = ${submission.id}`;
      await sql`delete from arena.submission_draft_items where submission_id = ${submission.id}`;
      await sql`delete from arena.upload_intents where submission_id = ${submission.id}`;
      await sql`delete from arena.submissions where id = ${submission.id}`;
    }
    await sql`delete from arena.workspace_progress where enrollment_id = ${enrollment.id}`;
    await sql`delete from audit.logs where entity_id = ${enrollment.id}`;
    await sql`delete from arena.enrollments where id = ${enrollment.id}`;
  }
  await sql`delete from notifications.deliveries where event_id in (select id from notifications.events where user_id = ${user.id})`;
  await sql`delete from notifications.events where user_id = ${user.id}`;
  await sql`delete from rewards.redemptions where user_id = ${user.id}`;
  await sql`delete from rewards.point_ledger where user_id = ${user.id}`;
  await sql`delete from rewards.point_accounts where user_id = ${user.id}`;
}

export async function getProjectId(sql: Sql) {
  const [project] = await sql`select id from arena.projects where slug = ${PROJECT_SLUG}`;
  if (!project) throw new Error("E2E fixture project is missing.");
  return project.id as string;
}

/**
 * The fixture participant is an established one, avatar already picked.
 *
 * `avatar_id` has to be set here rather than left null: null is what raises the
 * arrival picker, and that modal is deliberately not dismissable — left unset,
 * it would cover every `/app` page and every spec in this suite would fail on a
 * click that never reaches its target. First arrival is exercised on purpose in
 * avatar-picker.spec.ts, which clears the column itself.
 */
async function ensureUser(sql: Sql) {
  const [user] = await sql`
    insert into identity.users (auth_subject, email_cache, display_name_cache, avatar_id)
    values (${AUTH_SUBJECT}, 'e2e@example.test', 'E2E', 'rocket')
    on conflict (auth_subject) do update
      set email_cache = excluded.email_cache,
          display_name_cache = excluded.display_name_cache,
          avatar_id = excluded.avatar_id,
          updated_at = now()
    returning id`;
  return user.id as string;
}

async function ensureSubmittedFixture(sql: Sql) {
  const userId = await ensureUser(sql);
  const [week] = await sql`select id from arena.weeks where week_code = ${WEEK_CODE}`;
  if (!week) throw new Error("E2E fixture week is missing.");
  const [project] = await sql`select id from arena.projects where slug = ${PROJECT_SLUG}`;
  if (!project) throw new Error("E2E fixture project is missing.");
  const [linkRequirement] = await sql`
    select id from arena.project_submission_requirements
    where project_id = ${project.id} and type = 'LINK'
    order by sort_order asc
    limit 1`;
  const [rubric] = await sql`
    select id, max_score from arena.project_rubric_criteria
    where project_id = ${project.id}
    order by sort_order asc
    limit 1`;
  if (!linkRequirement || !rubric) throw new Error("E2E fixture project is missing its link requirement or rubric.");

  const [enrollment] = await sql`
    insert into arena.enrollments (user_id, week_id, project_id, status)
    values (${userId}, ${week.id}, ${project.id}, 'SUBMITTED')
    on conflict (user_id, week_id) do update
      set project_id = excluded.project_id,
          status = 'SUBMITTED',
          updated_at = now()
    returning id`;
  await sql`
    insert into arena.workspace_progress (enrollment_id, current_step)
    values (${enrollment.id}, 'SUBMIT')
    on conflict (enrollment_id) do update
      set current_step = excluded.current_step,
          updated_at = now()`;

  const [submission] = await sql`
    insert into arena.submissions (
      enrollment_id, user_id, week_id, project_id, status,
      draft_explanation, review_attempts_used
    )
    values (
      ${enrollment.id}, ${userId}, ${week.id}, ${project.id}, 'SUBMITTED',
      'Browser E2E submission explanation.', 1
    )
    on conflict (enrollment_id) do update
      set status = excluded.status,
          draft_explanation = excluded.draft_explanation,
          review_attempts_used = greatest(arena.submissions.review_attempts_used, 1),
          updated_at = now()
    returning id, latest_version_id`;
  await sql`
    insert into arena.submission_draft_items (submission_id, requirement_id, item_type, external_url)
    select ${submission.id}, ${linkRequirement.id}, 'LINK', 'https://example.com/'
    where not exists (
      select 1 from arena.submission_draft_items
      where submission_id = ${submission.id} and item_type = 'LINK'
    )`;

  let [version] = await sql`
    select id, submitted_at from arena.submission_versions
    where submission_id = ${submission.id} and review_attempt_number = 1
    order by version_number desc
    limit 1`;
  if (!version) {
    [version] = await sql`
      insert into arena.submission_versions (
        submission_id, version_number, explanation, submitted_at,
        access_status, review_attempt_number, review_status, is_final
      )
      values (
        ${submission.id}, 1, 'Browser E2E submission explanation.', now(),
        'ACCESSIBLE', 1, 'QUEUED', true
      )
      returning id, submitted_at`;
    await sql`
      insert into arena.submission_version_items (
        submission_version_id, requirement_id, item_type, external_url
      )
      values (${version.id}, ${linkRequirement.id}, 'LINK', 'https://example.com/')`;
  }
  await sql`
    update arena.submissions
    set latest_version_id = ${version.id}, review_attempts_used = greatest(review_attempts_used, 1), updated_at = now()
    where id = ${submission.id}`;
  await sql`
    insert into arena.review_jobs (submission_version_id, status, attempt_count)
    values (${version.id}, 'PENDING', 0)
    on conflict (submission_version_id) do nothing`;
  return { userId, weekId: week.id as string, projectId: project.id as string, enrollmentId: enrollment.id as string, submissionId: submission.id as string, versionId: version.id as string, submittedAt: version.submitted_at as Date, rubricId: rubric.id as string };
}

export async function finalizeSubmittedFixture(sql: Sql, input: { finalize: boolean }) {
  const fixture = await ensureSubmittedFixture(sql);
  const [review] = await sql`
    insert into arena.reviews (
      submission_version_id, run_number, status, ai_score, final_score,
      summary, strengths, improvements, review_confidence, review_model,
      review_model_version, prompt_version, reviewed_at
    )
    values (
      ${fixture.versionId}, 1, 'COMPLETED_HIDDEN', 88, 88,
      'Browser E2E review summary.',
      ${JSON.stringify(["Evidence is clear."])}::jsonb,
      ${JSON.stringify(["Add more detail next time."])}::jsonb,
      0.91, 'stub-dev-v1', 'e2e-fixture', 'browser-e2e', now()
    )
    on conflict (submission_version_id, run_number) do update
      set status = excluded.status,
          ai_score = excluded.ai_score,
          final_score = excluded.final_score,
          summary = excluded.summary,
          strengths = excluded.strengths,
          improvements = excluded.improvements,
          review_confidence = excluded.review_confidence,
          reviewed_at = excluded.reviewed_at,
          updated_at = now()
    returning id, final_score`;
  await sql`
    insert into arena.review_scores (review_id, rubric_criterion_id, raw_score, max_score, weighted_score, feedback, evidence)
    values (
      ${review.id}, ${fixture.rubricId}, 88, 100, 88,
      'Strong browser E2E fixture review.',
      ${JSON.stringify(["[link-1] Browser E2E submission explanation"])}::jsonb
    )
    on conflict (review_id, rubric_criterion_id) do update
      set raw_score = excluded.raw_score,
          max_score = excluded.max_score,
          weighted_score = excluded.weighted_score,
          feedback = excluded.feedback,
          evidence = excluded.evidence`;
  await sql`update arena.review_jobs set status = 'COMPLETED', attempt_count = greatest(attempt_count, 1), updated_at = now() where submission_version_id = ${fixture.versionId}`;
  await sql`update arena.submission_versions set review_status = 'COMPLETED', access_status = 'ACCESSIBLE', is_final = true where id = ${fixture.versionId}`;
  await sql`update arena.submissions set status = 'REVIEWED_HIDDEN', latest_version_id = ${fixture.versionId}, review_attempts_used = greatest(review_attempts_used, 1), updated_at = now() where id = ${fixture.submissionId}`;
  await sql`update arena.enrollments set status = 'REVIEW_READY', updated_at = now() where id = ${fixture.enrollmentId}`;

  if (!input.finalize) return { ...fixture, reviewId: review.id as string };

  await sql`
    insert into arena.weekly_rankings (
      week_id, user_id, project_id, submission_version_id, review_id,
      final_score, final_submitted_at, rank, points_awarded
    )
    values (${fixture.weekId}, ${fixture.userId}, ${fixture.projectId}, ${fixture.versionId}, ${review.id}, 88, ${fixture.submittedAt}, 1, 300)
    on conflict (week_id, user_id) do update
      set project_id = excluded.project_id,
          submission_version_id = excluded.submission_version_id,
          review_id = excluded.review_id,
          final_score = excluded.final_score,
          final_submitted_at = excluded.final_submitted_at,
          rank = excluded.rank,
          points_awarded = excluded.points_awarded`;
  await sql`
    insert into rewards.point_ledger (
      user_id, amount, entry_type, week_id, reference_type, reference_id,
      description, idempotency_key
    )
    values (${fixture.userId}, 300, 'WEEKLY_RANK', ${fixture.weekId}, 'weekly_ranking', ${fixture.versionId}, 'Browser E2E rank #1', ${`browser-e2e:${fixture.weekId}:${fixture.userId}`})
    on conflict (idempotency_key) do nothing`;
  await sql`
    insert into rewards.point_accounts (user_id, balance, lifetime_earned, lifetime_spent)
    values (${fixture.userId}, 300, 300, 0)
    on conflict (user_id) do update
      set balance = greatest(rewards.point_accounts.balance, 300),
          lifetime_earned = greatest(rewards.point_accounts.lifetime_earned, 300),
          updated_at = now()`;
  await sql`update arena.reviews set status = 'PUBLISHED', published_at = now(), updated_at = now() where id = ${review.id}`;
  await sql`update arena.submissions set status = 'FINALIZED', updated_at = now() where id = ${fixture.submissionId}`;
  await sql`update arena.enrollments set status = 'COMPLETED', completed_at = coalesce(completed_at, now()), updated_at = now() where id = ${fixture.enrollmentId}`;
  await sql`update arena.weeks set status = 'FINALIZED', closed_at = coalesce(closed_at, now()), finalized_at = coalesce(finalized_at, now()), updated_at = now() where id = ${fixture.weekId}`;
  return { ...fixture, reviewId: review.id as string };
}

export async function getFixtureSubmissionReviewState(sql: Sql) {
  const [state] = await sql`
    select s.status as submission_status, r.status as review_status, r.final_score
    from arena.submissions s
    join identity.users u on u.id = s.user_id
    join arena.submission_versions v on v.id = s.latest_version_id
    join arena.reviews r on r.submission_version_id = v.id
    where u.auth_subject = ${AUTH_SUBJECT}
    order by r.run_number desc
    limit 1`;
  if (!state) throw new Error("E2E fixture review is missing.");
  return {
    submissionStatus: state.submission_status as string,
    reviewStatus: state.review_status as string,
    finalScore: state.final_score as string,
  };
}

export async function ensureMilestoneReward(sql: Sql) {
  await finalizeSubmittedFixture(sql, { finalize: true });
  await sql`
    insert into rewards.catalog (slug, title, description, points_cost, reward_type, inventory_mode, is_active)
    values (${REWARD_SLUG}, 'Browser E2E Reward', 'Reward fixture for browser redemption.', 150, 'DIGITAL', 'UNLIMITED', true)
    on conflict (slug) do update
      set title = excluded.title,
          description = excluded.description,
          points_cost = excluded.points_cost,
          reward_type = excluded.reward_type,
          inventory_mode = excluded.inventory_mode,
          is_active = true,
          updated_at = now()`;
}
