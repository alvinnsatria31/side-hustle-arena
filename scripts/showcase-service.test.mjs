/**
 * Public Weekly Spotlight reads.
 *
 * The showcase was the last Arena surface served from `data/mock` — it published
 * invented winners and scores to every visitor. These tests hold the two things
 * that replace it: only FINALIZED weeks are published at all, and nothing
 * private rides along with what is.
 */
import assert from "node:assert/strict";
import test, { after } from "node:test";
import nextEnv from "@next/env";
import postgres from "postgres";
import {
  getLatestSpotlight,
  getSpotlightEntry,
  listSpotlightHistory,
  spotlightSlug,
} from "../src/server/finalization/showcase-service.ts";

nextEnv.loadEnvConfig(process.cwd());
assert.ok(["development", "test"].includes(process.env.APP_ENV), "Showcase fixtures require a non-production database");
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
after(() => sql.end({ timeout: 5 }));

const stamp = Date.now();
const CASE_BACKGROUND = "Toko fashion menyimpan penjualan di tiga berkas terpisah.";
const PRIVATE_FEEDBACK = "CATATAN-REVIEWER-RAHASIA-jangan-pernah-tampil-di-publik";

/**
 * Inserts a finalized week directly rather than driving close+finalize: this
 * suite is about what the public read publishes, not about how ranks are earned.
 */
async function finalizedWeek(t, { label, status = "FINALIZED", racers }) {
  const names = {
    weekCode: `E2E-SHOW-${label}-${stamp}`,
    divisionSlug: `e2e-show-div-${label}-${stamp}`,
    projectSlug: `e2e-show-project-${label}-${stamp}`,
  };
  const now = new Date();
  const [week] = await sql`
    insert into arena.weeks (week_code, title, status, opens_at, submission_deadline_at, finalized_at, timezone)
    values (${names.weekCode}, 'Showcase Week', ${status}, ${new Date(now.getTime() - 7 * 86400_000)},
            ${new Date(now.getTime() - 2 * 86400_000)},
            ${status === "FINALIZED" ? new Date(now.getTime() - 86400_000) : null}, 'Asia/Jakarta')
    returning id`;
  const [division] = await sql`
    insert into arena.divisions (slug, name, is_active, sort_order)
    values (${names.divisionSlug}, 'Showcase Division', true, 0) returning id`;
  const [project] = await sql`
    insert into arena.projects (week_id, division_id, slug, title, short_description, case_background, mission, status, published_at)
    values (${week.id}, ${division.id}, ${names.projectSlug}, 'Showcase Project', 'ringkasan publik',
            ${CASE_BACKGROUND}, 'Bangun satu dashboard.', 'PUBLISHED', ${now}) returning id`;

  const created = [];
  for (const [index, racer] of racers.entries()) {
    const [user] = await sql`
      insert into identity.users (auth_subject, display_name_cache)
      values (${`e2e-show-${label}-${index}-${stamp}`}, ${racer.displayName}) returning id`;
    const [enrollment] = await sql`
      insert into arena.enrollments (user_id, week_id, project_id, status)
      values (${user.id}, ${week.id}, ${project.id}, 'SUBMITTED') returning id`;
    const [submission] = await sql`
      insert into arena.submissions (enrollment_id, user_id, week_id, project_id, status)
      values (${enrollment.id}, ${user.id}, ${week.id}, ${project.id}, 'SUBMITTED') returning id`;
    const [version] = await sql`
      insert into arena.submission_versions (submission_id, version_number, submitted_at, access_status, review_status, is_final)
      values (${submission.id}, 1, ${now}, 'ACCESSIBLE', 'COMPLETED', true) returning id`;
    const [review] = await sql`
      insert into arena.reviews (submission_version_id, run_number, status, ai_score, final_score, summary)
      values (${version.id}, 1, 'PUBLISHED', ${racer.score}, ${racer.score}, ${PRIVATE_FEEDBACK}) returning id`;
    await sql`
      insert into arena.weekly_rankings (week_id, user_id, project_id, submission_version_id, review_id, final_score, final_submitted_at, rank, points_awarded)
      values (${week.id}, ${user.id}, ${project.id}, ${version.id}, ${review.id}, ${racer.score}, ${now}, ${index + 1}, ${racer.points})`;
    created.push({ userId: user.id, reviewId: review.id });
  }

  t.after(async () => {
    await sql`delete from arena.weekly_rankings where week_id = ${week.id}`;
    for (const row of created) {
      await sql`delete from arena.skill_evidence where review_id = ${row.reviewId}`;
      await sql`delete from arena.reviews where id = ${row.reviewId}`;
    }
    const enrollments = await sql`select id from arena.enrollments where week_id = ${week.id}`;
    for (const enrollment of enrollments) {
      const submissions = await sql`select id from arena.submissions where enrollment_id = ${enrollment.id}`;
      for (const submission of submissions) {
        await sql`delete from arena.submission_versions where submission_id = ${submission.id}`;
        await sql`delete from arena.submissions where id = ${submission.id}`;
      }
      await sql`delete from arena.enrollments where id = ${enrollment.id}`;
    }
    await sql`delete from arena.project_skills where project_id = ${project.id}`;
    await sql`delete from arena.projects where id = ${project.id}`;
    await sql`delete from arena.divisions where id = ${division.id}`;
    await sql`delete from arena.weeks where id = ${week.id}`;
    for (const row of created) await sql`delete from identity.users where id = ${row.userId}`;
  });

  return { weekId: week.id, weekCode: names.weekCode, projectId: project.id, racers: created };
}

test("a finalized week is published as ranks, scores and points — and nothing private", async (t) => {
  const week = await finalizedWeek(t, {
    label: "ok",
    racers: [
      { displayName: "Alvin P.", score: 88, points: 300 },
      { displayName: "Sari M.", score: 81, points: 200 },
    ],
  });

  const spotlight = await getLatestSpotlight();
  const mine = spotlight.filter((entry) => entry.weekCode === week.weekCode);
  assert.equal(mine.length, 2, "both ranked racers must be published");

  const [first, second] = mine;
  assert.equal(first.rank, 1);
  assert.equal(first.participantName, "Alvin P.");
  assert.equal(first.finalScore, 88);
  assert.equal(first.pointsAwarded, 300);
  assert.equal(first.divisionName, "Showcase Division");
  assert.equal(first.caseBackground, CASE_BACKGROUND, "the project's own brief is public");
  assert.equal(second.rank, 2);

  // The review row carries reviewer prose and the ranking carries a user id.
  // Neither may reach a public page.
  const serialised = JSON.stringify(mine);
  assert.equal(serialised.includes(PRIVATE_FEEDBACK), false, "reviewer feedback must never be published");
  assert.equal(serialised.includes("e2e-show-ok-0"), false, "an auth subject must never be published");
  assert.equal(Object.hasOwn(first, "summary"), false);
  assert.equal(Object.hasOwn(first, "userId"), false);
});

test("a week that is not FINALIZED is not published at all", async (t) => {
  const open = await finalizedWeek(t, {
    label: "closed",
    status: "CLOSED",
    racers: [{ displayName: "Belum Final", score: 95, points: 300 }],
  });

  const spotlight = await getLatestSpotlight();
  assert.equal(
    spotlight.some((entry) => entry.weekCode === open.weekCode),
    false,
    "results are published only after finalization (PRD §103)",
  );
  const history = await listSpotlightHistory();
  assert.equal(history.some((row) => row.weekCode === open.weekCode), false);
  assert.equal(await getSpotlightEntry(spotlightSlug(open.weekCode, 1)), null);
});

test("the slug resolves back to its own entry, and nothing else does", async (t) => {
  const week = await finalizedWeek(t, {
    label: "slug",
    racers: [
      { displayName: "Juara", score: 90, points: 300 },
      { displayName: "Kedua", score: 70, points: 200 },
    ],
  });

  const slug = spotlightSlug(week.weekCode, 2);
  const entry = await getSpotlightEntry(slug);
  assert.ok(entry, "a published rank must be reachable by its slug");
  assert.equal(entry.rank, 2);
  assert.equal(entry.participantName, "Kedua");
  assert.equal(entry.slug, slug, "the slug must round-trip");

  assert.equal(await getSpotlightEntry(spotlightSlug(week.weekCode, 99)), null, "an unranked position has no page");
  assert.equal(await getSpotlightEntry("not-a-real-slug"), null);
  assert.equal(await getSpotlightEntry(`${week.weekCode.toLowerCase()}-rank-abc`), null);
});

test("a participant without a display name is never shown as their auth subject", async (t) => {
  const week = await finalizedWeek(t, {
    label: "anon",
    racers: [{ displayName: null, score: 75, points: 300 }],
  });

  const entry = await getSpotlightEntry(spotlightSlug(week.weekCode, 1));
  assert.equal(entry.participantName, "Peserta Arena");

  const history = await listSpotlightHistory();
  const row = history.find((item) => item.weekCode === week.weekCode);
  assert.equal(row.winnerName, "Peserta Arena");
  assert.equal(row.finalScore, 75);
});

test("history lists one row per finalized week, newest first", async (t) => {
  const week = await finalizedWeek(t, {
    label: "hist",
    racers: [
      { displayName: "Pemenang", score: 92, points: 300 },
      { displayName: "Bukan pemenang", score: 60, points: 200 },
    ],
  });

  const history = await listSpotlightHistory();
  const mine = history.filter((row) => row.weekCode === week.weekCode);
  assert.equal(mine.length, 1, "history shows the winner of each week, not every racer");
  assert.equal(mine[0].winnerName, "Pemenang");
  assert.equal(mine[0].slug, spotlightSlug(week.weekCode, 1));

  const timestamps = history.map((row) => new Date(row.opensAt).getTime());
  assert.deepEqual(timestamps, [...timestamps].sort((a, b) => b - a), "newest week first");
});

test("an empty spotlight is empty, not invented", async () => {
  // With no fixture of its own this asserts the shape the pages rely on: the
  // reads always return arrays, so "no finalized week yet" renders as an empty
  // state rather than throwing or falling back to sample winners.
  const spotlight = await getLatestSpotlight();
  const history = await listSpotlightHistory();
  assert.ok(Array.isArray(spotlight));
  assert.ok(Array.isArray(history));
  for (const entry of spotlight) {
    assert.ok(entry.finalScore >= 0 && entry.finalScore <= 100);
    assert.ok(entry.rank >= 1);
    assert.equal(typeof entry.participantName, "string");
    assert.notEqual(entry.participantName.trim(), "");
  }
});
