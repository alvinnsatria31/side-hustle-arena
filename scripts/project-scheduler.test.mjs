import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
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
  assert.equal(crons.find((c) => c.path.endsWith("/project-generate")).schedule, "0 2-16 * * 0");
  assert.equal(crons.find((c) => c.path.endsWith("/project-drop")).schedule, "0 * * * *");
  const now = new Date("2026-09-06T02:00:00Z");
  const window = weeklyWindow(now);
  assert.ok(now >= window.previewAt && now < window.opensAt);
  assert.equal(window.opensAt.toISOString(), "2026-09-07T01:00:00.000Z");
});
