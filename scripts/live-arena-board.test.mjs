import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("countdown formats remaining time without negative values", async () => {
  const { formatCountdown } = await import("../src/lib/countdown.ts");
  assert.equal(formatCountdown(3_725_000), "1j 2m 5d");
  assert.equal(formatCountdown(0), "Selesai");
  assert.equal(formatCountdown(-10_000), "Selesai");
});

test("public Arena page renders the linked live board instead of KanbanPreview", () => {
  const componentPath = new URL("../src/components/arena/LiveArenaBoard.tsx", import.meta.url);
  assert.equal(existsSync(componentPath), true, "LiveArenaBoard component must exist");

  const page = read("src/app/(public)/arena/page.tsx");
  const board = read("src/components/arena/LiveArenaBoard.tsx");

  assert.match(page, /import \{ LiveArenaBoard \}/);
  assert.match(page, /<LiveArenaBoard/);
  assert.doesNotMatch(page, /<KanbanPreview/);
  assert.match(board, /PROYEK PEKAN INI/);
  assert.match(board, /DeadlineCountdown/);
  assert.match(board, /Belum ada proyek yang dibuka/);
});

/**
 * The hero panel and the landing card grid must not both list the week's
 * briefs — that duplication is what the panel was rewritten to remove. The
 * panel keeps the countdown, the joined-participant total and the week's point
 * ladder; the titles live in the ProjectCard grid under #proyek.
 */
test("live board is a status panel, not a second copy of the project list", () => {
  const page = read("src/app/(public)/arena/page.tsx");
  const board = read("src/components/arena/LiveArenaBoard.tsx");

  assert.doesNotMatch(board, /project\.title/, "board must not render project titles");
  assert.doesNotMatch(board, /projects\.map/, "board must not iterate the project list");
  assert.match(board, /Sisa waktu pengumpulan/);
  assert.match(board, /participantCount/);
  assert.match(board, /points\.rank1/);
  assert.match(board, /href="#proyek"/, "panel CTA points at the card grid");

  assert.match(page, /participantCount=\{participantTotal\}/);
  assert.match(page, /id="proyek"/);
  assert.match(page, /<ProjectCard/, "the landing lists projects as cards");
});

test("live board keeps the Stitch desktop proportions without breaking mobile", () => {
  const page = read("src/app/(public)/arena/page.tsx");
  const board = read("src/components/arena/LiveArenaBoard.tsx");

  assert.match(page, /max-w-\[1500px\]/);
  assert.match(page, /xl:grid-cols-\[minmax\(0,1fr\)_minmax\(0,900px\)\]/);
  assert.match(page, /max-w-\[900px\]/);
  assert.match(board, /sm:grid-cols-2/);
  assert.match(board, /sm:px-\[30px\]/);
  assert.match(board, /sm:pt-6/);
  // Card grid stays responsive: one column on phones, three on desktop.
  assert.match(page, /md:grid-cols-2 lg:grid-cols-3/);
});

test("public Arena home maps honest live board data", () => {
  const source = read("src/lib/arena-view.ts");

  assert.match(source, /participantCount: number/);
  assert.match(source, /estimatedTime: string/);
  assert.match(source, /deliverable: string/);
  assert.match(source, /deadlineAt: string/);
  assert.match(source, /export const getPublicArenaHome = unstable_cache/);
  assert.match(source, /groupBy\(enrollments\.projectId\)/);
  assert.match(source, /projectSubmissionRequirements/);
});
