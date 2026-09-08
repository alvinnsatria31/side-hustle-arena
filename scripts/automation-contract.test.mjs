// The scheduler contract: the n8n workflow JSON, the Vercel cron file, the
// route ceilings and EXECUTION_CONTRACT must agree.
//
// These four artefacts encode the same operational decisions in four
// languages, and they had drifted: identical review work declared 300s in one
// route and 60s in another, the grading workflow chose a 30s claim timeout
// independently of the claim's own budget, and the email flush ran once a day
// against a retry policy that needs several ticks. Nothing enforced any of it,
// so drift was invisible until something timed out in production.
//
// Reads files only. No workflow is imported, activated or called.
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { EXECUTION_CONTRACT, workerRoundTripFitsLease } from "../src/server/ops/execution-budget.ts";
import { flushCadenceIsSafe } from "../src/server/notifications/outbox-policy.ts";
import { JOBS } from "../src/server/scheduler/service.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (path) => JSON.parse(readFileSync(join(root, path), "utf8"));
const readText = (path) => readFileSync(join(root, path), "utf8");

const trigger = readJson("n8n/arena-trigger-workflow.json");
const grading = readJson("n8n/arena-grading-workflow.json");
const nodeNamed = (workflow, name) => workflow.nodes.find((node) => node.name === name);
const cronOf = (workflow, name) => nodeNamed(workflow, name)?.parameters?.rule?.interval?.[0]?.expression;

/** Every minute the given standard 5-field cron expression fires, over a week. */
function firesPerWeek(expression) {
  const [minute, hour, dom, month, dow] = expression.split(" ");
  const expand = (field, min, max) => {
    if (field === "*") return Array.from({ length: max - min + 1 }, (_, i) => min + i);
    return field.split(",").flatMap((part) => {
      const [range, step] = part.split("/");
      const stride = step ? Number(step) : 1;
      let from = min;
      let to = max;
      if (range !== "*") {
        const bounds = range.split("-").map(Number);
        from = bounds[0];
        to = bounds.length > 1 ? bounds[1] : (step ? max : bounds[0]);
      }
      const out = [];
      for (let value = from; value <= to; value += stride) out.push(value);
      return out;
    });
  };
  assert.equal(month, "*", "the contract test only models month-agnostic schedules");
  const minutes = expand(minute, 0, 59).length;
  const hours = expand(hour, 0, 23).length;
  const days = dom === "*" ? expand(dow, 0, 6).length : expand(dom, 1, 31).length;
  return minutes * hours * days;
}

test("the cron expression model matches known schedules", () => {
  // Guarding the guard: a wrong parser would silently pass every claim below.
  assert.equal(firesPerWeek("*/15 * * * *"), 4 * 24 * 7);
  assert.equal(firesPerWeek("0 8 * * *"), 7);
  assert.equal(firesPerWeek("0 9-20 * * 0"), 12);
  assert.equal(firesPerWeek("0 * * * *"), 24 * 7);
  assert.equal(firesPerWeek("0 */2 * * 6,0"), 12 * 2);
});

test("every job the trigger workflow dispatches actually exists", () => {
  const code = nodeNamed(trigger, "Which jobs are due").parameters.jsCode;
  const mapped = [...code.matchAll(/'([a-z-]+)'(?=[,\]])/g)].map((match) => match[1]);
  const jobs = mapped.filter((name) => name in JOBS);
  assert.ok(jobs.length >= 7, `expected the workflow to dispatch most jobs, saw ${jobs.join(", ")}`);
  for (const name of mapped) {
    // Anything quoted in the job arrays must be a real job; a typo here means a
    // scheduled job silently never runs.
    if (/^[a-z]+(-[a-z]+)+$/.test(name) && !(name in JOBS)) {
      assert.fail(`workflow dispatches unknown job "${name}"`);
    }
  }
  // reviews-run stays out: the grading workflow owns the review queue.
  assert.equal(code.includes("'reviews-run'"), false);
});

test("email-flush fires often enough for its own retry policy", () => {
  const code = nodeNamed(trigger, "Which jobs are due").parameters.jsCode;
  const owner = [...code.matchAll(/'([^']+)':\s*\[([^\]]*)\]/g)]
    .find(([, , jobs]) => jobs.includes("'email-flush'"))?.[1];
  assert.ok(owner, "no trigger owns email-flush");
  const expression = cronOf(trigger, owner);
  const intervalMs = (7 * 24 * 3600_000) / firesPerWeek(expression);
  assert.ok(flushCadenceIsSafe(intervalMs),
    `email-flush cadence "${expression}" (${Math.round(intervalMs / 60_000)}m) cannot exhaust the retry ladder inside the idempotency window`);
});

test("project-generate fires repeatedly through its window, because one tick cannot finish six divisions", () => {
  const code = nodeNamed(trigger, "Which jobs are due").parameters.jsCode;
  const owner = [...code.matchAll(/'([^']+)':\s*\[([^\]]*)\]/g)]
    .find(([, , jobs]) => jobs.includes("'project-generate'"))?.[1];
  assert.ok(owner, "no trigger owns project-generate");
  const fires = firesPerWeek(cronOf(trigger, owner));
  // Six divisions at one division-budget each cannot fit in one invocation.
  const perTick = Math.floor(EXECUTION_CONTRACT.drainBudgetMs / EXECUTION_CONTRACT.divisionBudgetMs);
  assert.ok(perTick < 6, "a single tick must not be assumed to cover every division");
  assert.ok(fires >= Math.ceil(6 / perTick),
    `project-generate fires ${fires}x/week but needs at least ${Math.ceil(6 / perTick)} ticks to cover six divisions`);
});

test("jobs-sync is scheduled, and often enough for a source to be tuned without a workflow edit", () => {
  const code = nodeNamed(trigger, "Which jobs are due").parameters.jsCode;
  const owner = [...code.matchAll(/'([^']+)':\s*\[([^\]]*)\]/g)]
    .find(([, , jobs]) => jobs.includes("'jobs-sync'"))?.[1];
  assert.ok(owner, "no trigger owns jobs-sync");
  const fires = firesPerWeek(cronOf(trigger, owner));
  // The job itself skips sources that are not due, so triggering more often
  // than the shortest per-source interval is free — and it is what lets an
  // operator change `sync_interval_minutes` on a row and have it take effect.
  assert.ok(fires >= 7, `jobs-sync fires only ${fires}x/week; a source cannot be tuned below daily`);
  assert.ok("jobs-sync" in JOBS);
});

test("the grading workflow's timeouts fit the lease it holds", () => {
  const timeout = (name) => nodeNamed(grading, name).parameters.options.timeout;
  assert.equal(timeout("Grade with model"), EXECUTION_CONTRACT.workerModelTimeoutMs);
  for (const call of ["Claim one job", "Complete the lease", "Report the failure"]) {
    assert.equal(timeout(call), EXECUTION_CONTRACT.workerHttpTimeoutMs,
      `${call} must wait for the Arena ceiling plus margin, not a number picked on its own`);
  }
  assert.ok(workerRoundTripFitsLease(),
    "a worker could still be running after its lease expired, which lets a second worker claim the same job");
});

test("the grading workflow reports which model actually graded", () => {
  const body = nodeNamed(grading, "Complete the lease").parameters.jsonBody;
  // Without this, every externally graded review was stored as the literal
  // string "external-worker" and provenance told you nothing.
  assert.match(body, /model:\s*\$env\.AI_REVIEW_MODEL/);
  assert.match(body, /workerId:\s*'n8n-grading'/);
});

test("route ceilings all state the same invocation limit", () => {
  for (const path of [
    "src/app/api/cron/[job]/route.ts",
    "src/app/api/internal/reviews/run/route.ts",
    "src/app/api/internal/reviews/claim/route.ts",
    "src/app/api/internal/reviews/complete/route.ts",
  ]) {
    const declared = readText(path).match(/export const maxDuration = (\d+)/);
    assert.ok(declared, `${path} does not declare maxDuration`);
    assert.equal(Number(declared[1]), EXECUTION_CONTRACT.invocationSeconds,
      `${path} declares a different ceiling than EXECUTION_CONTRACT.invocationSeconds`);
  }
});

test("the Vercel cron fallback only schedules real jobs", () => {
  const vercel = readJson("vercel.json");
  for (const entry of vercel.crons) {
    const job = entry.path.replace("/api/cron/", "");
    assert.ok(job in JOBS, `vercel.json schedules unknown job "${job}"`);
    assert.doesNotThrow(() => firesPerWeek(entry.schedule), `unparseable schedule for ${job}`);
  }
});

test("a week is closed within a day of its deadline, whichever day that falls on", () => {
  const code = nodeNamed(trigger, "Which jobs are due").parameters.jsCode;
  const ownerOf = (job) => [...code.matchAll(/'([^']+)':\s*\[([^\]]*)\]/g)]
    .find(([, , jobs]) => jobs.includes(`'${job}'`))?.[1];

  const closeOwner = ownerOf("week-close");
  assert.ok(closeOwner, "no trigger owns week-close");
  const fires = firesPerWeek(cronOf(trigger, closeOwner));
  // A weekly tick assumes every week ends on the weekly cycle. An ad-hoc week
  // whose deadline falls just after that tick waits a further seven days for
  // its results and points, which is what happened to ADHOC-2026-09-08-7543.
  // Closing at least daily bounds that wait by the tick interval instead.
  assert.ok(fires >= 7, `week-close fires only ${fires}x/week; an ad-hoc deadline could wait up to a week to close`);

  // Order matters: finalize only picks up FINALIZING, which is the state close
  // produces. Sharing one trigger keeps them in step — n8n sends the items this
  // node returns through the HTTP node in order.
  assert.equal(ownerOf("week-finalize"), closeOwner,
    "week-finalize must ride the same tick as week-close, after it");
  const jobs = [...code.matchAll(/'([^']+)':\s*\[([^\]]*)\]/g)].find(([, name]) => name === closeOwner)[2];
  assert.ok(jobs.indexOf("'week-close'") < jobs.indexOf("'week-finalize'"),
    "close must be dispatched before finalize, or finalize runs a tick behind");

  const fallback = JSON.parse(readText("vercel.json")).crons;
  const scheduleOf = (path) => fallback.find((cron) => cron.path === path)?.schedule;
  assert.ok(firesPerWeek(scheduleOf("/api/cron/week-close")) >= 7,
    "the Vercel fallback still closes weekly; it is coarse by plan, but it should not be the thing that delays a week");
});
