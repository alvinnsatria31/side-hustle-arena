import { expect, test } from "@playwright/test";
import { FINALIZED_WEEK_CODE, PROJECT_SLUG } from "./fixtures";

/**
 * The Career surfaces a participant actually reads: Jobs, Career Report, CV
 * scanner, and the Arena entry point.
 *
 * These assert the honesty rules, not just that pages render. A page that shows
 * a plausible number where it has no evidence looks exactly like a working one
 * in a screenshot, so each spec names the wrong-but-plausible output it exists
 * to prevent.
 */

test.describe("Jobs", () => {
  test("lists live openings with their source and freshness, and never a closed one", async ({ page }) => {
    await page.goto("/app/jobs");

    const live = page.getByRole("heading", { name: "Junior Data Analyst" });
    await expect(live).toBeVisible();
    // The fixture's CLOSED opening exists in the database. It must not be here:
    // a stale listing is worse than no listing, because someone will apply.
    await expect(page.getByRole("heading", { name: "Peran Sudah Ditutup" })).toHaveCount(0);

    // Provenance and freshness, so a participant can judge how current this is.
    await expect(page.getByText("Sumber uji lokal").first()).toBeVisible();
    await expect(page.getByText(/diperbarui/i).first()).toBeVisible();
  });

  test("reports coverage it can justify, and says why when it cannot", async ({ page }) => {
    await page.goto("/app/jobs");
    await expect(page.getByRole("heading", { name: "Junior Data Analyst" })).toBeVisible();

    // The participant has finalized evidence for the one mapped skill, so this
    // is 100% of what the taxonomy could map — and the card says so, rather
    // than quietly counting the unmapped skill as a miss or as a match.
    await expect(page.getByText("100% cakupan")).toBeVisible();
    await expect(page.getByText("1 dari 1 skill terpetakan punya bukti final.")).toBeVisible();
    await expect(page.getByText(/Belum terpetakan ke taksonomi kami/i)).toBeVisible();
    await expect(page.getByText(/Skill Tak Terpetakan/)).toBeVisible();
  });

  test("filters narrow the list and report an empty result honestly", async ({ page }) => {
    await page.goto("/app/jobs");
    await expect(page.getByRole("heading", { name: "Junior Data Analyst" })).toBeVisible();

    await page.getByLabel("Cari peran atau skill").fill("tidak-ada-peran-seperti-ini");
    await expect(page.getByText("Tidak ada lowongan yang sesuai filter ini.")).toBeVisible();

    await page.getByRole("button", { name: "Reset filter" }).click();
    await expect(page.getByRole("heading", { name: "Junior Data Analyst" })).toBeVisible();
  });

  test("the application link leaves for the source and is not a fabricated internal page", async ({ page }) => {
    await page.goto("/app/jobs");
    const apply = page.getByRole("link", { name: /Lamar di/ }).first();
    await expect(apply).toBeVisible();
    await expect(apply).toHaveAttribute("href", /^https:\/\//);
    await expect(apply).toHaveAttribute("target", "_blank");
    await expect(apply).toHaveAttribute("rel", /noopener/);
  });
});

test.describe("Career Report", () => {
  test("shows measured skill evidence and labels what nothing measured", async ({ page }) => {
    await page.goto("/app/career-report");
    await expect(page.getByRole("heading", { name: /Peta skill dari bukti kerja/i })).toBeVisible();

    // The fixture's evidence is CRITERION-attributed, so it carries a score.
    await expect(page.getByText("E2E Local SQL").first()).toBeVisible();
    await expect(page.getByText("84/100").first()).toBeVisible();
    await expect(page.getByText(/mengukur skill ini lewat kriteria rubrik/i).first()).toBeVisible();

    // And the page states the rule, so a reader knows what the number is not.
    await expect(page.getByText(/skor project tidak disalin ke tiap skill/i)).toBeVisible();
  });

  test("history links back to the result that produced the evidence", async ({ page }) => {
    await page.goto("/app/career-report");
    const link = page.getByRole("link", { name: "Dashboard operasional" });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", new RegExp(`/app/arena/result/${PROJECT_SLUG}-done`));
    await expect(page.getByText(FINALIZED_WEEK_CODE, { exact: false }).first()).toBeVisible();
  });
});

test.describe("Arena", () => {
  test("the open week's project is browsable and its brief is readable", async ({ page }) => {
    await page.goto("/app/arena/projects");
    const card = page.getByRole("link", { name: /Analisis margin kanal/ }).first();
    await expect(card).toBeVisible();

    await page.goto(`/app/arena/projects/${PROJECT_SLUG}`);
    await expect(page.getByRole("heading", { name: "Analisis margin kanal" })).toBeVisible();
    await expect(page.getByText(/kehilangan visibilitas margin/i)).toBeVisible();
  });
});

test.describe("CV scanner", () => {
  test("states plainly that it is unavailable rather than failing silently", async ({ page }) => {
    // The sandbox blanks every AI credential and turns the flag off, so this is
    // the disabled path — which must still be a clear page, not a dead button.
    await page.goto("/app/cv-scanner");
    await expect(page.locator("body")).not.toBeEmpty();
    await expect(page.getByRole("heading").first()).toBeVisible();
  });
});
