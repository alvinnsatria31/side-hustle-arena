import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import nextEnv from "@next/env";
import postgres from "postgres";
import { SignJWT } from "jose";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const arenaOrigin = "http://localhost:3001";
let startedServer = false;
let serverProcess;

function requireDevelopmentDatabase() {
  assert.equal(process.env.APP_ENV, "development", "Arena core live tests require APP_ENV=development");
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL must be configured for Arena core live tests");
}

async function serverReady() {
  try {
    const response = await fetch(`${arenaOrigin}/login`, { signal: AbortSignal.timeout(1_000) });
    return response.status === 200;
  } catch {
    return false;
  }
}

before(async () => {
  if (await serverReady()) return;
  serverProcess = spawn(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", "npm.cmd run dev -- -p 3001"], {
    cwd: process.cwd(),
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  serverProcess.unref();
  startedServer = true;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (await serverReady()) return;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  assert.fail("Arena development server did not start on localhost:3001");
});

after(async () => {
  if (startedServer && serverProcess?.pid) {
    await new Promise((resolve) => {
      const killer = spawn("taskkill.exe", ["/PID", String(serverProcess.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
      killer.once("exit", resolve);
      killer.once("error", resolve);
    });
  }
});

async function participantToken(subject) {
  const secret = process.env.SESSION_SECRET;
  assert.ok(secret, "SESSION_SECRET must be configured: the app verifies the participant cookie with it");
  return new SignJWT({ sub: subject, email: `${subject}@example.test`, username: subject, firstName: "Fixture" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(secret));
}

async function api(path, token, init = {}) {
  const headers = new Headers(init.headers);
  if (token) headers.set("cookie", `sk_participant=${token}`);
  const response = await fetch(`${arenaOrigin}${path}`, { ...init, headers });
  const body = response.status === 204 ? null : response.headers.get("content-type")?.includes("application/json") ? await response.json() : await response.text();
  return { response, body };
}

async function createFixture() {
  requireDevelopmentDatabase();
  const sql = postgres(process.env.DATABASE_URL, { max: 2 });
  const run = `phase3-${randomUUID().replaceAll("-", "")}`;
  const ids = Object.fromEntries([
    "divisionData", "divisionDesign", "divisionInactive", "weekOpen", "weekFuture", "projectData", "projectDesign", "projectDraft", "projectFuture", "userA", "userB", "userC",
  ].map((name) => [name, randomUUID()]));
  const now = new Date();
  const openAt = new Date(now.getTime() - 60 * 60 * 1_000);
  const deadlineAt = new Date(now.getTime() + 60 * 60 * 1_000);
  // auth_subject has to be what the app derives from the token, so provisioning
  // finds these fixture rows instead of creating new ones.
  const subjects = { userA: `${run}-user-a`, userB: `${run}-user-b`, userC: `${run}-user-c` };
  const tokens = {
    userA: await participantToken(subjects.userA),
    userB: await participantToken(subjects.userB),
    userC: await participantToken(subjects.userC),
  };

  await sql`insert into identity.users (id, auth_subject) values
    (${ids.userA}, ${`sk-participant:${subjects.userA}`}),
    (${ids.userB}, ${`sk-participant:${subjects.userB}`}),
    (${ids.userC}, ${`sk-participant:${subjects.userC}`})`;
  await sql`insert into arena.divisions (id, slug, name, sort_order) values
    (${ids.divisionData}, ${`${run}-data`}, 'Data', 1),
    (${ids.divisionDesign}, ${`${run}-design`}, 'Design', 2),
    (${ids.divisionInactive}, ${`${run}-inactive`}, 'Inactive', 3)`;
  await sql`update arena.divisions set is_active = false where id = ${ids.divisionInactive}`;
  await sql`insert into arena.weeks (id, week_code, title, status, opens_at, submission_deadline_at) values
    (${ids.weekOpen}, ${`${run}-open`}, 'Open fixture', 'OPEN', ${openAt}, ${deadlineAt}),
    (${ids.weekFuture}, ${`${run}-future`}, 'Future fixture', 'SCHEDULED', ${new Date(now.getTime() + 7 * 24 * 60 * 60 * 1_000)}, ${new Date(now.getTime() + 11 * 24 * 60 * 60 * 1_000)})`;
  await sql`insert into arena.week_rules (week_id, max_projects_per_user) values (${ids.weekOpen}, 1)`;
  await sql`insert into arena.projects (id, week_id, division_id, slug, title, short_description, status, published_at) values
    (${ids.projectData}, ${ids.weekOpen}, ${ids.divisionData}, ${`${run}-data-project`}, 'Published data project', 'Visible data project', 'PUBLISHED', ${openAt}),
    (${ids.projectDesign}, ${ids.weekOpen}, ${ids.divisionDesign}, ${`${run}-design-project`}, 'Published design project', 'Visible design project', 'PUBLISHED', ${openAt}),
    (${ids.projectDraft}, ${ids.weekOpen}, ${ids.divisionData}, ${`${run}-draft-project`}, 'Draft project', 'Hidden draft project', 'DRAFT', null),
    (${ids.projectFuture}, ${ids.weekFuture}, ${ids.divisionData}, ${`${run}-future-project`}, 'Future project', 'Hidden future project', 'PUBLISHED', ${new Date(now.getTime() + 7 * 24 * 60 * 60 * 1_000)})`;
  const skillId = randomUUID();
  await sql`insert into arena.skills (id, slug, name) values (${skillId}, ${`${run}-analysis`}, 'Analysis')`;
  await sql`insert into arena.project_skills (project_id, skill_id) values (${ids.projectData}, ${skillId})`;
  await sql`insert into arena.project_rubric_criteria (project_id, name, weight, max_score) values (${ids.projectData}, 'Quality', 1, 100)`;
  await sql`insert into arena.project_submission_requirements (project_id, label, type, required) values (${ids.projectData}, 'Public link', 'LINK', true)`;

  return {
    sql,
    ids,
    tokens,
    async cleanup() {
      await sql`delete from identity.sessions where user_id in (${ids.userA}, ${ids.userB}, ${ids.userC})`;
      await sql`delete from arena.workspace_progress where enrollment_id in (select id from arena.enrollments where user_id in (${ids.userA}, ${ids.userB}, ${ids.userC}))`;
      await sql`delete from arena.enrollments where user_id in (${ids.userA}, ${ids.userB}, ${ids.userC})`;
      await sql`delete from arena.project_skills where project_id in (${ids.projectData}, ${ids.projectDesign}, ${ids.projectDraft}, ${ids.projectFuture})`;
      await sql`delete from arena.project_rubric_criteria where project_id in (${ids.projectData}, ${ids.projectDesign}, ${ids.projectDraft}, ${ids.projectFuture})`;
      await sql`delete from arena.project_submission_requirements where project_id in (${ids.projectData}, ${ids.projectDesign}, ${ids.projectDraft}, ${ids.projectFuture})`;
      await sql`delete from arena.projects where id in (${ids.projectData}, ${ids.projectDesign}, ${ids.projectDraft}, ${ids.projectFuture})`;
      await sql`delete from arena.week_rules where week_id = ${ids.weekOpen}`;
      await sql`delete from arena.weeks where id in (${ids.weekOpen}, ${ids.weekFuture})`;
      await sql`delete from arena.divisions where id in (${ids.divisionData}, ${ids.divisionDesign}, ${ids.divisionInactive})`;
      await sql`delete from arena.skills where id = ${skillId}`;
      await sql`delete from identity.users where id in (${ids.userA}, ${ids.userB}, ${ids.userC})`;
      await sql.end({ timeout: 5 });
    },
  };
}

test("current week, divisions, and projects expose only current published data without shared caching", async () => {
  const fixture = await createFixture();
  try {
    const current = await api("/api/arena/week/current");
    assert.equal(current.response.status, 200);
    assert.equal(current.response.headers.get("cache-control"), "no-store");
    assert.equal(current.body.data.id, fixture.ids.weekOpen);

    const divisions = await api("/api/arena/divisions");
    assert.equal(divisions.response.status, 200);
    const divisionIds = divisions.body.data.map((division) => division.id);
    assert.equal(divisionIds.includes(fixture.ids.divisionData), true);
    assert.equal(divisionIds.includes(fixture.ids.divisionDesign), true);
    assert.equal(divisionIds.includes(fixture.ids.divisionInactive), false);

    const visible = await api("/api/arena/projects");
    assert.equal(visible.response.status, 200);
    assert.deepEqual(visible.body.data.map((project) => project.id).sort(), [fixture.ids.projectData, fixture.ids.projectDesign].sort());
    const projectSlug = (await fixture.sql`select slug from arena.projects where id = ${fixture.ids.projectData}`)[0].slug;
    const project = await api(`/api/arena/projects/${encodeURIComponent(projectSlug)}`);
    assert.equal(project.response.status, 200);
    assert.equal(project.body.data.skills.length, 1);
    assert.equal(project.body.data.rubric.length, 1);
    assert.equal(project.body.data.requirements.length, 1);
  } finally {
    await fixture.cleanup();
  }
});

test("enrollment requires a valid Arena session and same-origin mutation request", async () => {
  const fixture = await createFixture();
  try {
    const unauthenticated = await api("/api/arena/enrollments", undefined, { method: "POST", headers: { origin: arenaOrigin, "content-type": "application/json" }, body: JSON.stringify({ projectId: fixture.ids.projectData }) });
    assert.equal(unauthenticated.response.status, 401);
    const badOrigin = await api("/api/arena/enrollments", fixture.tokens.userA, { method: "POST", headers: { origin: "https://attacker.example", "content-type": "application/json" }, body: JSON.stringify({ projectId: fixture.ids.projectData }) });
    assert.equal(badOrigin.response.status, 403);
    const invalid = await api("/api/arena/enrollments", fixture.tokens.userA, { method: "POST", headers: { origin: arenaOrigin, "content-type": "application/json" }, body: JSON.stringify({ projectId: "not-a-uuid", userId: fixture.ids.userB }) });
    assert.equal(invalid.response.status, 400);
    assert.equal(invalid.body.error.code, "VALIDATION_ERROR");
  } finally {
    await fixture.cleanup();
  }
});

test("enrollment is cross-division, idempotent for the same project, conflict-safe for another project, and concurrent-safe", async () => {
  const fixture = await createFixture();
  try {
    const select = (token, projectId) => api("/api/arena/enrollments", token, { method: "POST", headers: { origin: arenaOrigin, "content-type": "application/json" }, body: JSON.stringify({ projectId }) });
    const first = await select(fixture.tokens.userA, fixture.ids.projectDesign);
    assert.equal(first.response.status, 201);
    assert.equal(first.body.data.enrollment.projectId, fixture.ids.projectDesign);
    const repeated = await select(fixture.tokens.userA, fixture.ids.projectDesign);
    assert.equal(repeated.response.status, 200);
    assert.equal(repeated.body.data.created, false);
    const conflict = await select(fixture.tokens.userA, fixture.ids.projectData);
    assert.equal(conflict.response.status, 409);
    assert.equal(conflict.body.error.code, "ALREADY_ENROLLED_THIS_WEEK");

    const concurrent = await Promise.all([select(fixture.tokens.userB, fixture.ids.projectData), select(fixture.tokens.userB, fixture.ids.projectData)]);
    assert.deepEqual(concurrent.map((result) => result.response.status).sort(), [200, 201]);
    const rows = await fixture.sql`select count(*)::int as count from arena.enrollments where user_id = ${fixture.ids.userB} and week_id = ${fixture.ids.weekOpen}`;
    assert.equal(rows[0].count, 1);
  } finally {
    await fixture.cleanup();
  }
});

test("enrollment and workspace enforce ownership and lock exactly at the persisted deadline", async () => {
  const fixture = await createFixture();
  try {
    const select = await api("/api/arena/enrollments", fixture.tokens.userA, { method: "POST", headers: { origin: arenaOrigin, "content-type": "application/json" }, body: JSON.stringify({ projectId: fixture.ids.projectData }) });
    assert.equal(select.response.status, 201);
    const enrollmentId = select.body.data.enrollment.id;
    const idor = await api(`/api/arena/enrollments/${enrollmentId}`, fixture.tokens.userB);
    assert.equal(idor.response.status, 404);
    const save = await api(`/api/arena/enrollments/${enrollmentId}/workspace`, fixture.tokens.userA, { method: "PATCH", headers: { origin: arenaOrigin, "content-type": "application/json" }, body: JSON.stringify({ currentStep: "WORK", planText: "Implement the scoped brief.", tools: ["Spreadsheet"] }) });
    assert.equal(save.response.status, 200);
    const read = await api(`/api/arena/enrollments/${enrollmentId}/workspace`, fixture.tokens.userA);
    assert.equal(read.response.status, 200);
    assert.equal(read.body.data.currentStep, "WORK");
    const workspaceIdor = await api(`/api/arena/enrollments/${enrollmentId}/workspace`, fixture.tokens.userB);
    assert.equal(workspaceIdor.response.status, 404);

    await fixture.sql`update arena.weeks set submission_deadline_at = ${new Date()} where id = ${fixture.ids.weekOpen}`;
    const locked = await api(`/api/arena/enrollments/${enrollmentId}/workspace`, fixture.tokens.userA, { method: "PATCH", headers: { origin: arenaOrigin, "content-type": "application/json" }, body: JSON.stringify({ notes: "Late change" }) });
    assert.equal(locked.response.status, 409);
    assert.equal(locked.body.error.code, "SELECTION_DEADLINE_PASSED");
  } finally {
    await fixture.cleanup();
  }
});
