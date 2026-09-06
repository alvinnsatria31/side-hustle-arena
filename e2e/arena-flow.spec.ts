import { readFileSync } from "node:fs";
import path from "node:path";
import type { Locator, Page } from "@playwright/test";
import {
  ensureMilestoneReward,
  finalizeSubmittedFixture,
  getFixtureSubmissionReviewState,
  getProjectId,
  PROJECT_SLUG,
  PROJECT_TITLE,
  WEEK_CODE,
} from "./fixture-db";
import { expect, test } from "./test-fixtures";

const WORKSPACE = `/app/arena/workspace/${PROJECT_SLUG}`;
const SUBMISSION = `/app/arena/submission/${PROJECT_SLUG}`;

/**
 * globalSetup probes whether the Tencent COS bucket allows this origin. Without
 * that rule the browser cannot PUT to storage at all, so the upload specs skip
 * with the reason instead of reporting the app as broken. Add the bucket rule
 * and they start running on the next run with no code change.
 */
const { corsReady, origin } = JSON.parse(
  readFileSync(path.join(process.cwd(), "e2e", ".auth", "env.json"), "utf8"),
) as { corsReady: boolean; origin: string };

const CORS_REASON =
  `Tencent COS bucket has no CORS rule for ${origin}: the browser preflight for PUT ` +
  `is refused, so no file can reach storage from a page. Allow this origin with ` +
  `methods GET/PUT/HEAD and header content-type on the bucket, then rerun.`;

const MANDATORY_REVIEW_ITEMS = [
  "Deliverables lengkap",
  "Output dapat diakses",
  "Requirement terpenuhi",
  "Insight mudah dipahami",
];

/** Enrol through the API (fast path); the UI enrol case is covered separately. */
async function enrolViaApi(page: Page, projectId: string) {
  const response = await page.request.post("/api/arena/enrollments", {
    headers: { origin, "content-type": "application/json" },
    data: { projectId },
  });
  expect([200, 201]).toContain(response.status());
}

function isVisible(locator: Locator) {
  return locator.first().isVisible().catch(() => false);
}

/**
 * Drive the workspace to its submit step.
 *
 * Each click waits for the button that only exists on the following step, which
 * is what Playwright's auto-waiting is for — polling the "Step N" caption
 * instead made the helper wait on text that may not have re-rendered yet.
 *
 * Steps are skipped when their button is absent: the current step is persisted
 * server-side, so a later visit resumes wherever the previous one stopped.
 */
async function reachSubmitStep(page: Page) {
  await page.goto(WORKSPACE);

  // The workspace fetches its project, enrolment, week and draft before it can
  // render a step, so wait for whichever step it resumes on to actually be on
  // screen. Without this the non-waiting isVisible checks below all read false
  // against the loading state and every advance is skipped.
  await page
    .getByRole("button", {
      name: /Saya Paham|Simpan Plan|Lanjut ke Review|Lanjut ke Submit|Submit Project/,
    })
    .first()
    .waitFor({ timeout: 90_000 });

  const advances = [
    { click: "Saya Paham, Mulai Rencanakan", reveals: "Simpan Plan & Mulai Kerja" },
    { click: "Simpan Plan & Mulai Kerja", reveals: "Lanjut ke Review Checklist" },
    { click: "Lanjut ke Review Checklist", reveals: "Lanjut ke Submit" },
  ];

  for (const advance of advances) {
    const button = page.getByRole("button", { name: advance.click });
    if (!(await isVisible(button))) continue;
    await button.click();
    await page.getByRole("button", { name: advance.reveals }).waitFor({ timeout: 90_000 });
  }

  const toSubmit = page.getByRole("button", { name: "Lanjut ke Submit" });
  if (await isVisible(toSubmit)) {
    for (const label of MANDATORY_REVIEW_ITEMS) {
      const box = page.getByRole("checkbox", { name: label }).first();
      if ((await box.getAttribute("aria-checked")) === "false") await box.click();
    }
    await toSubmit.click();
  }

  await expect(page.getByLabel("Pilih file deliverables")).toBeAttached({ timeout: 90_000 });
}

test.describe.serial("Arena end-to-end", () => {
  test("the signed-in user sees the live project in the browser", async ({ page }) => {
    await page.goto("/app/arena/projects");
    await expect(page.getByText(PROJECT_TITLE).first()).toBeVisible();
  });

  test("the project detail renders for a signed-in user", async ({ page }) => {
    await page.goto(`/app/arena/projects/${PROJECT_SLUG}`);
    await expect(page.getByRole("heading", { name: PROJECT_TITLE })).toBeVisible();
    await expect(page.getByRole("button", { name: "Pilih Project Ini" })).toBeVisible();
  });

  // Regression guard: enrolment used to be gated on `state.user` from the
  // localStorage demo store, which never learns about the real session cookie,
  // so a signed-in user got the login modal instead of an enrolment. The server
  // decides now — an anonymous visitor still gets the modal, from the 401.
  test("enrolling from the project detail UI", async ({ page }) => {
    await page.goto(`/app/arena/projects/${PROJECT_SLUG}`);
    await page.getByRole("button", { name: "Pilih Project Ini" }).click();
    // Enrolling loads the workspace, which a dev server compiles on first visit.
    await expect(page).toHaveURL(new RegExp(WORKSPACE), { timeout: 90_000 });
  });

  test("the workspace walks to the submit step with an empty deliverables list", async ({ page, db }) => {
    await page.goto("/app/arena");
    await enrolViaApi(page, await getProjectId(db));
    await reachSubmitStep(page);
    await expect(page.getByText("Deliverables · 0 / 5 file")).toBeVisible();
    await expect(page.getByText("Links · 0 / 5")).toBeVisible();
  });

  // Type and size are refused in the browser before any storage call, so this
  // holds regardless of the bucket's CORS state.
  test("unsupported and oversized files are refused before any upload starts", async ({ page, artifact }) => {
    await reachSubmitStep(page);
    const picker = page.getByLabel("Pilih file deliverables");

    await picker.setInputFiles(artifact("catatan.txt"));
    await expect(page.getByText(/tipe file tidak didukung/i)).toBeVisible();
    await expect(page.getByText("catatan.txt")).toHaveCount(0);

    await picker.setInputFiles(artifact("kegedean.pdf"));
    await expect(page.getByText(/melebihi 20 MB/i)).toBeVisible();
    await expect(page.getByText("kegedean.pdf")).toHaveCount(0);

    await expect(page.getByText("Deliverables · 0 / 5 file")).toBeVisible();
  });

  test("uploading a file keeps it in the draft across a reload", async ({ page, artifact }) => {
    test.skip(!corsReady, CORS_REASON);
    await reachSubmitStep(page);
    await page.getByLabel("Pilih file deliverables").setInputFiles(artifact("deliverable.pdf"));

    await expect(page.getByText("deliverable.pdf")).toBeVisible();
    await expect(page.getByText("· Uploaded")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("Deliverables · 1 / 5 file")).toBeVisible();

    // The draft lives on the server, so a reload must show the same file.
    await reachSubmitStep(page);
    await expect(page.getByText("deliverable.pdf")).toBeVisible();
    await expect(page.getByText("Deliverables · 1 / 5 file")).toBeVisible();
  });

  test("a link can be added to the draft", async ({ page }) => {
    await reachSubmitStep(page);
    await page.getByLabel("Tambah submission link").fill("https://example.com/");
    await page.getByRole("button", { name: "Tambah" }).click();
    await expect(page.getByText("https://example.com/")).toBeVisible();
    await expect(page.getByText("Links · 1 / 5")).toBeVisible();
  });

  test("submitting seals attempt 1 and the submission page lists the draft", async ({ page }) => {
    await reachSubmitStep(page);
    for (const label of ["Link dapat diakses", "Deliverables lengkap", "Permission sudah benar"]) {
      await page.getByRole("checkbox", { name: label }).last().click();
    }
    await page.getByRole("button", { name: "Submit Project" }).click();

    await expect(page).toHaveURL(new RegExp(SUBMISSION), { timeout: 60_000 });
    await expect(page.getByText("https://example.com/")).toBeVisible();
    if (corsReady) await expect(page.getByText("deliverable.pdf")).toBeVisible();
  });

  test("a local AI review produces sealed feedback before finalization", async ({ page, db }) => {
    await finalizeSubmittedFixture(db, { finalize: false });

    const state = await getFixtureSubmissionReviewState(db);
    expect(state.submissionStatus).toBe("REVIEWED_HIDDEN");
    expect(state.reviewStatus).toBe("COMPLETED_HIDDEN");
    expect(Number(state.finalScore)).toBeGreaterThan(0);

    await page.goto(`/app/arena/result/${PROJECT_SLUG}`);
    await expect(page.getByRole("heading", { name: "Feedback belum bisa dibuka." })).toBeVisible();
    await expect(page.getByText("Jatah review kepakai 1/3")).toBeVisible();
  });

  test("the sealed result unseals after local finalization", async ({ page, db }) => {
    await finalizeSubmittedFixture(db, { finalize: true });

    await page.goto(`/app/arena/result/${PROJECT_SLUG}`);
    await expect(page.getByRole("heading", { name: "Great work." })).toBeVisible();
    await expect(page.getByText("Peringkat #1").first()).toBeVisible();
    await expect(page.getByText("+300")).toBeVisible();

    await page.goto(SUBMISSION);
    await expect(page.getByText("FINAL", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Lihat Result" })).toBeVisible();
  });

  test("the leaderboard reflects the finalized submission", async ({ page }) => {
    await page.goto("/app/arena/leaderboard");
    await expect(page.getByRole("heading", { name: WEEK_CODE })).toBeVisible();
    const board = page.getByRole("table");
    await expect(board.getByRole("cell", { name: "#1" })).toBeVisible();
    await expect(board.getByText("E2E", { exact: true })).toBeVisible();
    await expect(board.getByText(PROJECT_TITLE)).toBeVisible();
    await expect(board.getByRole("cell", { name: "+300" })).toBeVisible();
  });

  test("a milestone reward can be redeemed", async ({ page, db }) => {
    await ensureMilestoneReward(db);

    await page.goto("/app/profile#rewards");
    await page.getByRole("button", { name: "Klaim reward" }).click();
    await expect(page.getByText("Reward berhasil diklaim.", { exact: true })).toBeVisible();
    await expect(page.getByText("Sudah diklaim")).toBeVisible();
    await expect(page.getByText("Menunggu")).toBeVisible();
  });

  test("the submitted file downloads through a signed grant", async ({ page }) => {
    test.skip(!corsReady, CORS_REASON);
    await page.goto(SUBMISSION);
    const button = page.getByRole("button", { name: /Download deliverable\.pdf/i });
    await expect(button).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 30_000 }),
      button.click(),
    ]);
    expect(download.suggestedFilename()).toBe("deliverable.pdf");
  });
});

/*
 * PLACEHOLDERS — each needs a service or a decision that does not exist yet.
 * Left as `fixme` so every run lists them as outstanding rather than silently
 * missing coverage.
 */
test.describe("Arena end-to-end: not yet coverable", () => {
  // Signing in happens on sekolah-karir-website, a separate application that is
  // not running here. globalSetup signs the same sk_participant token the main
  // site would issue, so everything downstream of the cookie is the real path.
  test.fixme("signing in on the main site and arriving through /arena/enter", async () => {});

  test.fixme("real external AI review produces scores and feedback", async () => {});
});
