/**
 * The rules the submission form and the submit endpoint must agree on.
 *
 * Preproduction audit findings 5 and 11: the form was built for one link box
 * and one file box, so a project asking for two of either had a requirement
 * with no input at all, and the labels promised "Jumat 23:59" on weeks that end
 * on other days. Both are now single, shared, pure rules — which is the only
 * reason a test can hold them to the same answer.
 *
 * Pure modules only. No database, no browser, no network.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  capacityFor,
  countForRequirement,
  minimumFor,
  overfilledRequirements,
  unmetRequirements,
} from "../src/lib/submission-requirements.ts";
import { deadlineLabel, deadlinePhrase, deadlineSentence } from "../src/lib/deadline.ts";
import { resourceKind } from "../src/server/generation/core.ts";

const linkA = { id: "req-link-a", label: "Link analisis", type: "LINK", required: true, minItems: 1, maxItems: 1 };
const linkB = { id: "req-link-b", label: "Link slide", type: "LINK", required: true, minItems: 1, maxItems: 1 };
const file = { id: "req-file", label: "File ringkasan", type: "FILE", required: false, minItems: 0, maxItems: 3 };

test("two requirements of the same type are counted separately", () => {
  // The exact shape that used to fail: both links saved against the first
  // requirement, so the second stayed empty and the submit was refused.
  const bothOnFirst = [{ requirementId: linkA.id }, { requirementId: linkA.id }];
  assert.deepEqual(unmetRequirements([linkA, linkB], bothOnFirst).map((r) => r.id), [linkB.id]);
  assert.deepEqual(overfilledRequirements([linkA, linkB], bothOnFirst).map((r) => r.id), [linkA.id]);

  const oneEach = [{ requirementId: linkA.id }, { requirementId: linkB.id }];
  assert.deepEqual(unmetRequirements([linkA, linkB], oneEach), []);
  assert.deepEqual(overfilledRequirements([linkA, linkB], oneEach), []);
});

test("an optional requirement is complete while empty; a required one is not", () => {
  assert.deepEqual(unmetRequirements([file], []), []);
  assert.equal(minimumFor(file), 0);
  // required with minItems 0 still needs one item — the server's rule.
  assert.equal(minimumFor({ required: true, minItems: 0 }), 1);
  assert.equal(minimumFor({ required: false, minItems: 2 }), 2);
});

test("a requirement never exceeds the global per-submission cap", () => {
  assert.equal(capacityFor({ maxItems: 3 }, 5), 3);
  assert.equal(capacityFor({ maxItems: 9 }, 5), 5, "a generous maxItems cannot lift the submission-wide limit");
});

test("items with no requirement count for nothing", () => {
  // requirementId is nullable: deleting a requirement sets it null rather than
  // dropping the item, and an orphan must not satisfy anything.
  assert.equal(countForRequirement(linkA.id, [{ requirementId: null }]), 0);
  assert.deepEqual(unmetRequirements([linkA], [{ requirementId: null }]).map((r) => r.id), [linkA.id]);
});

test("deadline wording follows the week, not a hardcoded Friday", () => {
  // 2026-09-08 is a Tuesday; ADHOC-2026-09-08 is the real week that exposed this.
  const tuesday = new Date("2026-09-08T16:59:00.000Z"); // 23:59 WIB
  // id-ID separates hours and minutes with a dot: "23.59".
  assert.match(deadlineLabel(tuesday), /^Selasa · 23[.:]59$/);
  assert.match(deadlineSentence(tuesday), /Selasa, 8 September 2026 pukul 23[.:]59 WIB|Selasa, 8 September 2026, 23[.:]59 WIB/);
  assert.match(deadlinePhrase(tuesday), /^sampai Selasa/);

  const friday = new Date("2026-09-11T16:59:00.000Z");
  assert.match(deadlineLabel(friday), /^Jumat · 23[.:]59$/);
});

test("a missing deadline says nothing rather than guessing a day", () => {
  assert.equal(deadlinePhrase(null), "sampai deadline minggu ini");
  assert.equal(deadlinePhrase(undefined, "sebelum deadline"), "sebelum deadline");
  assert.equal(deadlineLabel("not a date"), "");
  assert.equal(deadlineSentence("not a date"), "");
});

test("resource kind is inferred for the icon, and falls back honestly", () => {
  assert.equal(resourceKind({ label: "Data penjualan", url: "https://example.com/sales.csv" }), "DATASET");
  assert.equal(resourceKind({ label: "Dataset transaksi", url: "https://docs.google.com/spreadsheets/d/abc" }), "DATASET");
  assert.equal(resourceKind({ label: "Template laporan", url: "https://docs.google.com/document/d/abc" }), "TEMPLATE");
  assert.equal(resourceKind({ label: "Panduan brand", url: "https://example.com/guide.pdf" }), "DOCUMENT");
  assert.equal(resourceKind({ label: "Dashboard contoh", url: "https://lookerstudio.google.com/reporting/x" }), "LINK");
  // A URL the parser cannot read must not throw; the icon is not worth a crash.
  assert.equal(resourceKind({ label: "Bahan", url: "not-a-url" }), "LINK");
});
