import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import test from "node:test";
import { promisify } from "node:util";
import nextEnv from "@next/env";
import postgres from "postgres";

const { loadEnvConfig } = nextEnv;
const execFileAsync = promisify(execFile);
loadEnvConfig(process.cwd());

function requireDevelopmentDatabase() {
  assert.equal(process.env.APP_ENV, "development", "Arena core seed tests require APP_ENV=development");
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL must be configured for Arena core seed tests");
}

async function runSeed() {
  await execFileAsync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", "npm.cmd run db:seed:arena"], { cwd: process.cwd(), windowsHide: true });
}

async function snapshot(sql) {
  const weeks = await sql`select id, status from arena.weeks where week_code = 'DEV-ARENA-CORE-CURRENT'`;
  assert.equal(weeks.length, 1, "the development seed must own one deterministic current week");
  const projects = await sql`
    select projects.slug, projects.status, divisions.slug as division_slug
    from arena.projects projects
    join arena.divisions divisions on divisions.id = projects.division_id
    where projects.week_id = ${weeks[0].id} and projects.slug like 'dev-arena-core-%'
    order by projects.slug
  `;
  const childCounts = await sql`
    select
      (select count(*)::int from arena.project_skills ps join arena.projects p on p.id = ps.project_id where p.week_id = ${weeks[0].id} and p.slug like 'dev-arena-core-%') as skills,
      (select count(*)::int from arena.project_rubric_criteria pr join arena.projects p on p.id = pr.project_id where p.week_id = ${weeks[0].id} and p.slug like 'dev-arena-core-%') as rubric,
      (select count(*)::int from arena.project_submission_requirements sr join arena.projects p on p.id = sr.project_id where p.week_id = ${weeks[0].id} and p.slug like 'dev-arena-core-%') as requirements
  `;
  return { week: weeks[0], projects, childCounts: childCounts[0] };
}

test("development Arena core seed is idempotent and provides published plus hidden draft project fixtures", async () => {
  requireDevelopmentDatabase();
  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  try {
    await runSeed();
    const first = await snapshot(sql);
    await runSeed();
    const second = await snapshot(sql);
    assert.deepEqual(second, first, "a second seed run must not create duplicate logical data");
    assert.equal(first.projects.filter((project) => project.status === "PUBLISHED").length, 3, "one published project is required for each seeded active division");
    assert.equal(first.projects.filter((project) => project.status === "DRAFT").length, 1, "a seeded draft is required to verify visibility filtering");
    assert.equal(first.childCounts.skills > 0, true);
    assert.equal(first.childCounts.rubric > 0, true);
    assert.equal(first.childCounts.requirements > 0, true);
  } finally {
    await sql.end({ timeout: 5 });
  }
});
