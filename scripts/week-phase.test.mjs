import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { weekPhase, ENROLMENT_LABEL, PROJECT_LIST_TITLE, PROJECT_LIST_LEDE } = await import("../src/lib/week-phase.ts");
const { getWeekSelectionState } = await import("../src/server/arena/week-service.ts").catch(() => ({}));

test("a week is open only while a brief can still be taken", () => {
  assert.equal(weekPhase({ canSelect: true }), "open");
});

test("not open yet and already over are told apart", () => {
  assert.equal(weekPhase({ canSelect: false, reason: "WEEK_NOT_OPEN" }), "upcoming");
  for (const reason of ["WEEK_CLOSED", "SELECTION_DEADLINE_PASSED", "WEEK_NOT_FOUND", undefined]) {
    assert.equal(weekPhase({ canSelect: false, reason }), "closed", String(reason));
  }
});

test("every phase has its own wording on every surface that names the week", () => {
  for (const phase of ["open", "upcoming", "closed"]) {
    assert.ok(ENROLMENT_LABEL[phase]);
    assert.ok(PROJECT_LIST_TITLE[phase]);
    assert.ok(PROJECT_LIST_LEDE[phase]);
  }
  assert.equal(new Set(Object.values(PROJECT_LIST_TITLE)).size, 3);
  // The regression: a finished week was headed "Proyek Minggu Ini".
  assert.doesNotMatch(PROJECT_LIST_TITLE.closed, /minggu ini/i);
  assert.doesNotMatch(PROJECT_LIST_TITLE.upcoming, /minggu ini/i);
});

test("the reasons the phase reads are the ones the week service produces", { skip: !getWeekSelectionState }, () => {
  const base = { opensAt: new Date("2026-09-07T01:00:00Z"), submissionDeadlineAt: new Date("2026-09-14T16:59:00Z") };
  const during = new Date("2026-09-10T00:00:00Z");
  assert.equal(weekPhase(getWeekSelectionState({ ...base, status: "OPEN" }, during)), "open");
  assert.equal(weekPhase(getWeekSelectionState({ ...base, status: "OPEN" }, new Date("2026-10-09T00:00:00Z"))), "closed");
  assert.equal(weekPhase(getWeekSelectionState({ ...base, status: "FINALIZED" }, during)), "closed");
  assert.equal(weekPhase(getWeekSelectionState({ ...base, status: "OPEN" }, new Date("2026-09-01T00:00:00Z"))), "upcoming");
  assert.equal(weekPhase(getWeekSelectionState(null, during)), "closed");
});

test("sign-in goes to the main site's gate with this app as the destination", () => {
  const route = readFileSync(new URL("../src/app/auth/login/route.ts", import.meta.url), "utf8");
  assert.match(route, /new URL\("\/masuk", canonicalOrigin\)/);
  assert.match(route, /searchParams\.set\("next", new URL\("\/app", arenaOrigin\)\.toString\(\)\)/);
  // The teaser page that used to be the gate is gone; pointing at it again would loop.
  assert.doesNotMatch(route, /new URL\("\/arena"/);
});
