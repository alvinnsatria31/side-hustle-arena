import test from "node:test";
import assert from "node:assert/strict";
import { validatePackage, chooseCandidate, fingerprint, isDuplicate, publicationBlock, weeklyWindow, generationConfig } from "../src/server/generation/core.ts";

const divisionId = "11111111-1111-4111-8111-111111111111";
const skillId = "22222222-2222-4222-8222-222222222222";
function fixture() {
  return {
    divisionId, title: "Inventory reorder decision", shortDescription: "Use the supplied inventory observations to propose a reorder policy.",
    caseBackground: "A community shop records stockouts and holding costs in the observations included in this brief.",
    roleDescription: "You are the inventory analyst advising the shop owner.",
    objective: "Recommend an evidence-backed reorder policy that balances availability and cost.",
    mission: "Compare the observed demand and inventory costs, state assumptions, and present the recommended reorder decision.",
    difficulty: "STANDARD", estimatedMinutes: 480,
    skills: [{ skillId, weight: 1 }],
    rubric: [{ name: "Evidence", description: "Evidence supporting the recommendation", weight: 1, maxScore: 100,
      reviewInstruction: "Strong: traceable calculations support the decision. Weak: unsupported claims. Evidence: annotated calculations and assumptions." }],
    requirements: [{ label: "Decision brief", type: "LINK", required: true, minItems: 1, maxItems: 1,
      allowedMimeTypes: [], allowedLinkTypes: [], instructions: "Submit a publicly readable brief with calculations and assumptions." }],
    resources: [],
    fingerprint: { industry: "retail", role: "inventory analyst", coreSkill: "inventory analysis", secondarySkill: "communication",
      scenarioType: "stockout", decisionType: "reorder policy", primaryDeliverable: "decision brief", inputDataType: "inventory observations",
      targetStakeholder: "shop owner", toolCategory: "spreadsheet" },
  };
}
const context = () => ({ divisionId, skillIds: [skillId], baseRubric: fixture().rubric });

test("full packages pass; incomplete content, unsupported delivery and changed base rubric fail", () => {
  assert.equal(validatePackage(fixture(), context()).title, fixture().title);
  for (const mutate of [
    (p) => { p.caseBackground = ""; },
    (p) => { p.rubric[0].weight = 2; },
    (p) => { p.rubric[0].reviewInstruction = ""; },
    (p) => { p.requirements[0].type = "TEXT"; },
    (p) => { p.requirements[0].minItems = 2; },
    (p) => { p.skills[0].skillId = divisionId; },
    (p) => { p.resources = [{ label: "Data", url: "http://private.test/data" }]; },
  ]) {
    const p = fixture(); mutate(p);
    assert.throws(() => validatePackage(p, context()));
  }
});

test("fingerprint ignores title changes and catches recent scenario duplicates", () => {
  const p = fixture(); const renamed = { ...p, title: "A totally different title" };
  assert.equal(fingerprint(p).hash, fingerprint(renamed).hash);
  assert.equal(isDuplicate(renamed, [p]), true);
  const different = fixture();
  for (const key of Object.keys(different.fingerprint)) different.fingerprint[key] = `different ${key}`;
  different.mission = "Investigate a hiring funnel and recommend an interview scheduling experiment with a measurable outcome.";
  different.objective = "Reduce interview cancellation rates through a measurable scheduling policy.";
  different.caseBackground = "A recruiting team experiences appointment cancellations across its hiring process.";
  assert.equal(isDuplicate(different, [p]), false);
});

test("provider failure is bounded to three attempts then uses a validated library template", async () => {
  let calls = 0;
  const result = await chooseCandidate({ context: context(), history: [], library: [{ projectId: "source", tag: "HIGH_QUALITY", package: fixture() }],
    provider: { name: "test-outage", generate: async () => { calls++; throw new Error("provider secret must not enter audit"); } } });
  assert.equal(calls, 3);
  assert.equal(result.source, "library");
  assert.equal(result.sourceProjectId, "source");
  assert.equal(result.attempts.length, 3);
  assert.ok(!JSON.stringify(result).includes("provider secret"));
});

test("invalid AI output and duplicate evergreen content cannot become success", async () => {
  const result = await chooseCandidate({ context: context(), history: [fixture()],
    library: [{ projectId: "source", tag: "EVERGREEN", package: fixture() }],
    provider: { name: "invalid", generate: async () => ({ title: "not a package" }) } });
  assert.equal(result.package, undefined);
  assert.equal(result.source, "failed");
});

test("library order prefers HIGH_QUALITY over EVERGREEN and unconfigured AI makes no attempts", async () => {
  const result = await chooseCandidate({ context: context(), history: [], library: [
    { projectId: "evergreen", tag: "EVERGREEN", package: fixture() },
    { projectId: "high-quality", tag: "HIGH_QUALITY", package: fixture() },
  ] });
  assert.equal(result.sourceProjectId, "high-quality");
  assert.equal(result.attempts.length, 0);
});

test("publication enforces dates, vetoes, preview interval and immutable week states", () => {
  const now = new Date("2026-09-07T01:00:00Z");
  const week = { status: "PREVIEW", opensAt: now, submissionDeadlineAt: new Date("2026-09-11T17:00:00Z") };
  const project = { status: "PREVIEWED", previewStatus: "PENDING", scheduledPublishAt: now };
  const validatedAt = new Date("2026-09-06T02:00:00Z");
  assert.equal(publicationBlock({ week, project, now, validatedAt, previewHours: 6 }), null);
  assert.match(publicationBlock({ week, project: { ...project, previewStatus: "REJECTED" }, now, validatedAt, previewHours: 6 }), /veto/i);
  assert.match(publicationBlock({ week, project, now, validatedAt: now, previewHours: 6 }), /preview/i);
  assert.match(publicationBlock({ week: { ...week, status: "FINALIZED" }, project, now, validatedAt, previewHours: 6 }), /week/i);
  assert.match(publicationBlock({ week, project, now: new Date(now.getTime() - 1), validatedAt, previewHours: 6 }), /due/i);
  assert.match(publicationBlock({ week, project, now: week.submissionDeadlineAt, validatedAt, previewHours: 6 }), /deadline/i);
});

test("Jakarta weekly schedule is stable across the Sunday/Monday UTC boundary", () => {
  const sunday = weeklyWindow(new Date("2026-09-06T02:00:00Z"));
  assert.equal(sunday.opensAt.toISOString(), "2026-09-07T01:00:00.000Z");
  assert.equal(sunday.previewAt.toISOString(), "2026-09-06T02:00:00.000Z");
  assert.equal(sunday.submissionDeadlineAt.toISOString(), "2026-09-11T16:59:59.999Z");
  assert.equal(weeklyWindow(new Date("2026-09-06T18:00:00Z")).weekCode, sunday.weekCode);
});

test("generationConfig treats a blank env value as unset, not zero", () => {
  // .env.example ships these keys blank; copying it forward must not crash
  // every generation with Number("") === 0 out of range. Regression for a bug
  // found running the off-schedule release end to end against the sandbox.
  const blank = generationConfig({ ARENA_GENERATION_WINDOW_WEEKS: "", ARENA_GENERATION_SIMILARITY_THRESHOLD: "  ", ARENA_GENERATION_PREVIEW_HOURS: "" });
  assert.equal(blank.windowWeeks, 12);
  assert.equal(blank.threshold, 0.8);
  assert.equal(blank.previewHours, 6);

  // A real out-of-range value is still rejected — only blank means "unset".
  assert.throws(() => generationConfig({ ARENA_GENERATION_WINDOW_WEEKS: "3" }), /Invalid ARENA_GENERATION_WINDOW_WEEKS/);
  assert.equal(generationConfig({ ARENA_GENERATION_WINDOW_WEEKS: "10" }).windowWeeks, 10);
});
