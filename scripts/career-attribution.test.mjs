// One measurement must not become several claims.
//
// Finalization used to write the project's overall final score onto every skill
// the project touched: an 82 became "Excel 82, SQL 82, Communication 82", and
// nothing downstream could tell that those were one number wearing three hats.
// The Career Report then averaged them per skill, and Jobs treated their
// existence as proof of the skill.
//
// These tests also cover the shared skill vocabulary, because the two problems
// are the same problem seen twice: a claim about a skill is only as good as the
// evidence actually attached to that skill.
import assert from "node:assert/strict";
import test from "node:test";
import { attributeSkillEvidence, attributionCoverage } from "../src/server/finalization/skill-attribution.ts";
import { buildSkillIndex, derivedAliases } from "../src/server/career/skill-taxonomy.ts";
import { hasShowcaseConsent, showcaseDecision } from "../src/server/finalization/showcase-consent.ts";

const SQL = "skill-sql";
const EXCEL = "skill-excel";
const COMMS = "skill-comms";

const criterion = (id, skillId, over = {}) => ({ id, skillId, weight: 1, maxScore: 100, ...over });
const score = (id, raw, max = 100) => ({ rubricCriterionId: id, rawScore: raw, maxScore: max });

test("a skill measured by its own criteria gets its own score", () => {
  const rows = attributeSkillEvidence({
    projectSkills: [SQL, EXCEL],
    criteria: [criterion("c1", SQL), criterion("c2", EXCEL)],
    scores: [score("c1", 90), score("c2", 50)],
    projectScore: 70,
  });
  const bySkill = Object.fromEntries(rows.map((row) => [row.skillId, row]));
  assert.equal(bySkill[SQL].score, 90);
  assert.equal(bySkill[SQL].attribution, "CRITERION");
  assert.equal(bySkill[SQL].criterionCount, 1);
  assert.equal(bySkill[EXCEL].score, 50);
  // The project score never appears: it is the average of two different things.
  assert.ok(rows.every((row) => row.score !== 70));
});

test("several criteria for one skill combine by weight, not by count", () => {
  const rows = attributeSkillEvidence({
    projectSkills: [SQL],
    criteria: [criterion("c1", SQL, { weight: 3 }), criterion("c2", SQL, { weight: 1 })],
    scores: [score("c1", 80), score("c2", 40)],
    projectScore: 10,
  });
  // (80*3 + 40*1) / 4 = 70
  assert.equal(rows[0].score, 70);
  assert.equal(rows[0].criterionCount, 2);
});

test("criteria on different scales are normalised before they combine", () => {
  const rows = attributeSkillEvidence({
    projectSkills: [SQL],
    criteria: [criterion("c1", SQL, { maxScore: 10 }), criterion("c2", SQL, { maxScore: 100 })],
    scores: [score("c1", 9, 10), score("c2", 50, 100)],
    projectScore: 0,
  });
  // 90% and 50% of their own maxima → 70, not (9 + 50) / 2.
  assert.equal(rows[0].score, 70);
});

test("an unattributed skill records the project score and says so", () => {
  const rows = attributeSkillEvidence({
    projectSkills: [SQL, COMMS],
    criteria: [criterion("c1", SQL)],
    scores: [score("c1", 90)],
    projectScore: 62,
  });
  const comms = rows.find((row) => row.skillId === COMMS);
  assert.equal(comms.score, 62);
  assert.equal(comms.attribution, "PROJECT", "the label is what stops a reader treating this as a measurement");
  assert.equal(comms.criterionCount, 0);
});

test("a criterion the review never scored contributes nothing", () => {
  // An incomplete review is an infrastructure failure. Reading a missing score
  // as zero would charge the participant for it.
  const rows = attributeSkillEvidence({
    projectSkills: [SQL],
    criteria: [criterion("c1", SQL), criterion("c2", SQL)],
    scores: [score("c1", 80)],
    projectScore: 20,
  });
  assert.equal(rows[0].score, 80);
  assert.equal(rows[0].criterionCount, 1);
});

test("scores are clamped, deduplicated and never fabricated", () => {
  assert.equal(attributeSkillEvidence({
    projectSkills: [SQL, SQL],
    criteria: [criterion("c1", SQL)],
    scores: [score("c1", 400)],
    projectScore: 50,
  }).length, 1, "a duplicate project skill produces one row");
  assert.equal(attributeSkillEvidence({
    projectSkills: [SQL],
    criteria: [criterion("c1", SQL)],
    scores: [score("c1", 400)],
    projectScore: 50,
  })[0].score, 100);
  assert.deepEqual(attributeSkillEvidence({ projectSkills: [], criteria: [], scores: [], projectScore: 90 }), []);
  // A criterion with a zero maximum cannot express anything; it is skipped, and
  // the skill falls back to project attribution rather than dividing by zero.
  const degenerate = attributeSkillEvidence({
    projectSkills: [SQL],
    criteria: [criterion("c1", SQL, { maxScore: 0 })],
    scores: [score("c1", 5, 0)],
    projectScore: 33,
  });
  assert.equal(degenerate[0].attribution, "PROJECT");
  assert.equal(degenerate[0].score, 33);
});

test("attribution coverage shows an admin how wired-up a rubric is", () => {
  const coverage = attributionCoverage(
    [criterion("c1", SQL), criterion("c2", null), criterion("c3", SQL)],
    [SQL, EXCEL, COMMS],
  );
  assert.deepEqual(coverage, { attributedCriteria: 2, totalCriteria: 3, measuredSkills: 1, totalSkills: 3 });
});

// ------------------------------------------------------------------ taxonomy

test("one vocabulary resolves names, slugs and curated aliases", () => {
  const index = buildSkillIndex(
    [{ id: EXCEL, name: "Excel", slug: "excel" }, { id: SQL, name: "SQL", slug: "sql" }],
    [{ skillId: EXCEL, alias: "ms excel" }],
  );
  assert.equal(index.resolve("Excel"), EXCEL);
  assert.equal(index.resolve("  excel  "), EXCEL);
  assert.equal(index.resolve("MS-Excel!"), EXCEL, "punctuation must not defeat a lookup");
  assert.equal(index.resolve("sql"), SQL);
  assert.equal(index.nameOf(EXCEL), "Excel");
  // An unknown name resolves to nothing rather than to a plausible neighbour.
  assert.equal(index.resolve("Kepemimpinan"), null);
  assert.equal(index.resolve(""), null);
});

test("a curated alias overrides a derived key, and derivation stays mechanical", () => {
  const index = buildSkillIndex(
    [{ id: EXCEL, name: "Excel", slug: "excel" }, { id: SQL, name: "SQL", slug: "sql" }],
    // Deliberately perverse: the curator says this spelling means SQL.
    [{ skillId: SQL, alias: "excel" }],
  );
  assert.equal(index.resolve("Excel"), SQL, "a curated alias is the deliberate answer");

  // Derivation handles spelling, never meaning: no invented synonyms.
  assert.deepEqual(derivedAliases("Microsoft Excel").sort(), ["excel", "microsoft excel"]);
  assert.ok(derivedAliases("Excel").includes("ms excel"));
  assert.deepEqual(derivedAliases(""), []);
  assert.equal(derivedAliases("Data Visualization").includes("business intelligence"), false);
});

// ------------------------------------------------------------------- consent

test("the showcase publishes nobody without a positive, timestamped consent", () => {
  assert.equal(hasShowcaseConsent({ showcaseConsentAt: null }), false, "private by default");
  assert.equal(hasShowcaseConsent({ showcaseConsentAt: new Date(), status: "ACTIVE" }), true);
  assert.equal(hasShowcaseConsent({ showcaseConsentAt: new Date(), status: "SUSPENDED" }), false);
  assert.equal(hasShowcaseConsent({ showcaseConsentAt: new Date(), anonymizedAt: new Date() }), false);
});

test("a withheld entry says which reason withheld it", () => {
  assert.deepEqual(showcaseDecision({ showcaseConsentAt: new Date(), status: "ACTIVE" }), { publish: true });
  assert.deepEqual(showcaseDecision({ showcaseConsentAt: null }), { publish: false, reason: "NO_CONSENT" });
  assert.deepEqual(showcaseDecision({ showcaseConsentAt: new Date(), status: "SUSPENDED" }), { publish: false, reason: "NOT_ACTIVE" });
  // Deletion beats consent: a withdrawn account must not stay featured because
  // it once agreed.
  assert.deepEqual(
    showcaseDecision({ showcaseConsentAt: new Date(), status: "ACTIVE", anonymizedAt: new Date() }),
    { publish: false, reason: "ANONYMIZED" },
  );
});
