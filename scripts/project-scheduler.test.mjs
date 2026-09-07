import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { runProjectGenerate, runProjectDrop } from "../src/server/scheduler/service.ts";
import { weeklyWindow } from "../src/server/generation/core.ts";
import { ArenaDomainError } from "../src/server/arena/errors.ts";

function fixture(overrides = {}) {
  const calls = [];
  const deps = {
    config: () => ({ enabled: true, autoPublish: true }),
    prepare: async ({ now }) => { calls.push(["prepare", now]); return { weekId: "week-1", created: false }; },
    provider: () => undefined,
    generate: async () => { calls.push(["generate"]); return { results: [{ divisionId: "d1", projectId: "p1" }] }; },
    due: async () => [{ id: "week-1", weekCode: "ARENA-2026-09-07" }],
    publish: async ({ weekId }) => { calls.push(["publish", weekId]); return { published: ["p1"], held: [] }; },
    ...overrides,
  };
  return { calls, deps };
}

test("disabled automation has no DB or provider side effects", async () => {
  const { calls, deps } = fixture({ config: () => ({ enabled: false, autoPublish: false }), due: async () => { throw Error("unexpected DB read"); } });
  assert.equal((await runProjectGenerate(new Date(), deps)).done, false);
  assert.equal((await runProjectDrop(new Date(), deps)).done, false);
  assert.deepEqual(calls, []);
});

test("Sunday creates preview only, Monday publishes without regenerating", async () => {
  const { calls, deps } = fixture();
  const sunday = new Date("2026-09-06T02:00:00Z");
  assert.equal((await runProjectGenerate(sunday, deps)).done, true);
  assert.deepEqual(calls.map(([name]) => name), ["prepare", "generate"]);
  const monday = new Date("2026-09-07T01:00:00Z");
  assert.equal((await runProjectDrop(monday, deps)).done, true);
  assert.deepEqual(calls.map(([name]) => name), ["prepare", "generate", "publish"]);
});

test("generation reports blocked divisions and out-of-window skips", async () => {
  const { deps } = fixture({ generate: async () => ({ results: [{ divisionId: "d1", failed: "missing library" }] }) });
  assert.equal((await runProjectGenerate(new Date(), deps)).done, false);
  deps.prepare = async () => ({ skipped: "outside the Sunday generation window" });
  assert.match((await runProjectGenerate(new Date(), deps)).detail.skipped, /Sunday/);
});

test("publication reports held projects, retries them, and isolates week failures", async () => {
  let attempt = 0;
  const { deps } = fixture({ publish: async () => ++attempt === 1 ? { published: [], held: [{ projectId: "p1", reason: "preview" }] } : { published: ["p1"], held: [] } });
  assert.equal((await runProjectDrop(new Date(), deps)).done, false);
  assert.equal((await runProjectDrop(new Date(), deps)).done, true);
  deps.due = async () => [{ id: "bad" }, { id: "good" }];
  deps.publish = async ({ weekId }) => {
    if (weekId === "bad") throw new ArenaDomainError("WEEK_NOT_READY", "pending review");
    return { published: ["p2"], held: [] };
  };
  const result = await runProjectDrop(new Date(), deps);
  assert.equal(result.done, false);
  assert.equal(result.detail.results.length, 2);
  assert.deepEqual(result.detail.results[1].published, ["p2"]);
});

test("cron dates fit the preview window and publication opening", async () => {
  const { crons } = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
  assert.equal(crons.find((c) => c.path.endsWith("/project-generate")).schedule, "0 2 * * 0");
  assert.equal(crons.find((c) => c.path.endsWith("/project-drop")).schedule, "0 4 * * *");
  const now = new Date("2026-09-06T02:00:00Z");
  const window = weeklyWindow(now);
  assert.ok(now >= window.previewAt && now < window.opensAt);
  assert.equal(window.opensAt.toISOString(), "2026-09-07T01:00:00.000Z");
  const fallbackDrop = new Date("2026-09-07T04:00:00Z");
  assert.ok(fallbackDrop >= window.opensAt && fallbackDrop < window.submissionDeadlineAt);
});

test("n8n publication fires at opening and retries held or off-schedule weeks", async () => {
  const workflow = JSON.parse(await readFile(new URL("../n8n/arena-trigger-workflow.json", import.meta.url), "utf8"));
  assert.equal(workflow.settings.timezone, "Asia/Jakarta");
  const drop = workflow.nodes.find(node => node.id === "tick-drop");
  const expression = drop.parameters.rule.interval[0].expression.split(" ");
  // These publication slots must all exist: opening, a retry, and an ad-hoc week.
  for (const date of ["2026-09-07T08:00:00+07:00", "2026-09-07T09:00:00+07:00", "2026-09-08T08:00:00+07:00"]) {
    const local = new Date(new Date(date).getTime() + 7 * 3600_000);
    const fields = [local.getUTCMinutes(), local.getUTCHours(), local.getUTCDate(), local.getUTCMonth() + 1, local.getUTCDay()];
    assert.ok(expression.every((field, index) => field === "*" || Number(field) === fields[index]), `No publication tick at ${date}`);
  }
  const router = workflow.nodes.find(node => node.id === "route");
  for (const trigger of workflow.nodes.filter(node => node.type === "n8n-nodes-base.scheduleTrigger")) {
    const routed = runInNewContext(`(function () { ${router.parameters.jsCode} })()`, { $prevNode: { name: trigger.name } });
    assert.ok(routed.length > 0, `${trigger.name} must route to a job`);
    assert.ok(workflow.connections[trigger.name].main[0].some(connection => connection.node === router.name));
    if (trigger.id === "tick-drop") assert.equal(routed[0].json.job, "project-drop");
    if (trigger.id === "tick-reviews") assert.equal(routed[0].json.job, "reviews-run");
  }
});

test("exactly one workflow owns the review queue", async () => {
  // `claimReviewJob` is a single queue. The scheduler's `reviews-run` job and
  // the grading workflow's /reviews/claim both draw from it, so activating both
  // puts two systems on one queue — the same shape as the legacy Supabase
  // workflows the VPS audit flagged as P1. The lease keeps it correct, not
  // sensible. This test makes the ownership explicit rather than tribal.
  const load = async (name) => JSON.parse(await readFile(new URL(`../n8n/${name}`, import.meta.url), "utf8"));
  const scheduler = await load("arena-trigger-workflow.json");
  const grading = await load("arena-grading-workflow.json");

  const router = scheduler.nodes.find(node => node.id === "route");
  const scheduled = new Set();
  for (const trigger of scheduler.nodes.filter(node => node.type === "n8n-nodes-base.scheduleTrigger")) {
    for (const item of runInNewContext(`(function () { ${router.parameters.jsCode} })()`, { $prevNode: { name: trigger.name } })) {
      scheduled.add(item.json.job);
    }
  }
  assert.ok(!scheduled.has("reviews-run"), "the scheduler must not run reviews; the grading workflow owns that queue");

  // And the grading workflow must actually claim, or nothing reviews at all.
  const claims = grading.nodes.some(node => typeof node.parameters?.url === "string" && node.parameters.url.includes("/api/internal/reviews/claim"));
  assert.ok(claims, "the grading workflow must claim from the review queue");

  // Every scheduled job must still be a real job name.
  const known = ["week-close", "week-finalize", "email-flush", "week-notifications",
    "session-cleanup", "storage-cleanup", "project-drop", "project-generate", "reviews-run"];
  for (const job of scheduled) assert.ok(known.includes(job), `unknown job "${job}"`);

  // Both workflows must pin WIB, or a cron expression means a different hour.
  assert.equal(scheduler.settings.timezone, "Asia/Jakarta");
  assert.equal(grading.settings.timezone, "Asia/Jakarta");
});
