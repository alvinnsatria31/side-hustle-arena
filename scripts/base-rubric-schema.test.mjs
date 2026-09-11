// A division's base rubric can now be frozen from the console, before the
// division has any project. Freezing is permanent, so a rubric no package could
// ever satisfy would block the division for good — these are the shapes that
// must be refused at the door.
import assert from "node:assert/strict";
import test from "node:test";
import { baseRubricSchema, rubricHash } from "../src/server/generation/core.ts";

const rubric = [
  { name: "Problem framing", weight: 30, maxScore: 100 },
  { name: "Evidence", weight: 70, maxScore: 100 },
];

test("a base rubric is exactly the part the rubric hash covers", () => {
  assert.deepEqual(baseRubricSchema.parse(rubric), rubric);
  // Prose is written per project, never frozen with the base.
  assert.equal(baseRubricSchema.safeParse([{ ...rubric[0], description: "What this criterion measures." }]).success, false);
  // Trimmed on the way in, so the frozen hash matches what a package names.
  assert.equal(
    rubricHash(baseRubricSchema.parse([{ name: "  Evidence ", weight: 70, maxScore: 100 }])),
    rubricHash([{ name: "Evidence", weight: 70, maxScore: 100 }]),
  );
});

test("rubrics no package could satisfy are refused", () => {
  const refused = {
    "no criteria": [],
    "too many criteria": Array.from({ length: 21 }, (_, index) => ({ name: `Criterion ${index}`, weight: 1, maxScore: 100 })),
    "name too short": [{ name: "x", weight: 1, maxScore: 100 }],
    "zero weight": [{ name: "Valid", weight: 0, maxScore: 100 }],
    "max score over 100": [{ name: "Valid", weight: 1, maxScore: 101 }],
    // validatePackage calls these one criterion, so no package can list both.
    "duplicate after normalization": [{ name: "Problem framing", weight: 1, maxScore: 100 }, { name: "problem-framing", weight: 1, maxScore: 100 }],
  };
  for (const [why, candidate] of Object.entries(refused)) {
    assert.equal(baseRubricSchema.safeParse(candidate).success, false, why);
  }
});
