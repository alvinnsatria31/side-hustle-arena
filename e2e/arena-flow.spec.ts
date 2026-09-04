import { readFileSync } from "node:fs";
import path from "node:path";
import type { Locator, Page } from "@playwright/test";
import { getProjectId, PROJECT_SLUG, PROJECT_TITLE } from "./fixture-db";
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

/** Enrol through the API — see the `test.fail` case for why not through the UI. */
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

/** Step transitions remount their subtree, so a button can vanish mid-click. */
async function clickIfPresent(locator: Locator) {
  try {
    await locator.first().click({ timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Drive the workspace to its submit step. Written as a loop rather than a fixed
 * click sequence because the current step is persisted server-side, so a second
 * visit resumes wherever the previous test left off.
 */
async function reachSubmitStep(page: Page) {
  await page.goto(WORKSPACE);
  const submitStep = page.getByText("Step 5 · Submit");

  for (let guard = 0; guard < 8; guard += 1) {
    if (await isVisible(submitStep)) break;

    const toSubmit = page.getByRole("button", { name: "Lanjut ke Submit" });
    if (await isVisible(toSubmit)) {
      for (const label of MANDATORY_REVIEW_ITEMS) {
        const box = page.getByRole("checkbox", { name: label }).first();
        if ((await box.getAttribute("aria-checked")) === "false") await box.click();
      }
      await clickIfPresent(toSubmit);
      continue;
    }

    let advanced = false;
    for (const name of [
      "Saya Paham, Mulai Rencanakan",
      "Simpan Plan & Mulai Kerja",
      "Lanjut ke Review Checklist",
    ]) {
      const button = page.getByRole("button", { name });
      if (await isVisible(button)) {
        advanced = await clickIfPresent(button);
        if (advanced) break;
      }
    }
    if (!advanced) await page.waitForTimeout(500);
  }

  await expect(submitStep).toBeVisible();
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

  // KNOWN GAP, not a flake. ProjectDetail gates enrolment on `state.user` from
  // the localStorage demo store (useDemo), which never learns about the real
  // session cookie, so a genuinely signed-in user gets the login modal instead
  // of an enrolment. ArenaSessionProvider exists for exactly this migration but
  // ProjectDetail has not moved onto it yet. Once it does, Playwright reports
  // "passed unexpectedly" here — delete the test.fail() line then.
  test("enrolling from the project detail UI", async ({ page }) => {
    test.fail();
    await page.goto(`/app/arena/projects/${PROJECT_SLUG}`);
    await page.getByRole("button", { name: "Pilih Project Ini" }).click();
    await expect(page).toHaveURL(new RegExp(WORKSPACE), { timeout: 10_000 });
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
  // Needs the canonical auth server on :3000 (separate codebase, not running
  // here). Until then globalSetup mints the session directly.
  test.fixme("logging in through the real Sekolah Karir SSO", async () => {});

  // The review provider is still `stub-dev-v1`; no real model or Hermes worker
  // is wired up, so there is nothing honest to assert.
  test.fixme("an AI review produces scores and feedback", async () => {});

  // Finalization runs on a Friday scheduler that is not live; triggering it by
  // hand would test the harness, not the product.
  test.fixme("the sealed result unseals after finalization", async () => {});

  // Leaderboard is API-only; the user-facing page still renders mock data.
  test.fixme("the leaderboard reflects the finalized submission", async () => {});

  // Rewards/milestone APIs exist but no redemption flow is wired to a UI.
  test.fixme("a milestone reward can be redeemed", async () => {});
});
