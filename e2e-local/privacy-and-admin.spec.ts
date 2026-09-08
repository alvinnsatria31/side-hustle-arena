import { expect, test } from "@playwright/test";
import path from "node:path";
import { DISPLAY_NAME_PARTICIPANT } from "./fixtures";

/**
 * Consent, the admin readiness surfaces, and the error states that matter.
 *
 * The consent specs are the ones worth having: a Showcase that publishes a
 * participant who never agreed looks identical, on screen, to one that got
 * permission first. Only a test that drives the toggle can tell them apart.
 */

const ADMIN_STATE = path.join(process.cwd(), "e2e-local", ".auth", "admin.json");

test.describe("Showcase consent", () => {
  test("the showcase is empty until a participant opts in, and says why", async ({ page }) => {
    await page.goto("/arena/showcase");
    // Scoped to <main>: the signed-in header carries the visitor's own name, and
    // asserting against the whole page would match that instead of the listing.
    const main = page.getByRole("main");
    // The fixture's finalized week has a rank-1 participant who has NOT
    // consented. The page must explain that, not imply nobody finished.
    await expect(main.getByText(/belum mengizinkan|Belum ada peserta yang mengizinkan/i).first()).toBeVisible();
    await expect(main.getByText(DISPLAY_NAME_PARTICIPANT)).toHaveCount(0);
  });

  test("granting consent publishes, and withdrawing it unpublishes", async ({ page }) => {
    await page.goto("/app/profile");
    const grant = page.getByRole("button", { name: "Izinkan tampil di Showcase" });
    // Enabled, not merely visible: the control renders server-side and is
    // disabled until the privacy state has loaded and the page has hydrated.
    // Clicking before that lands on markup React has not adopted yet, and the
    // click silently does nothing.
    await expect(grant).toBeEnabled();
    await expect(page.getByText(/mati secara default/i)).toBeVisible();
    await grant.click();
    await expect(page.getByText(/boleh tampil di Showcase publik/i)).toBeVisible();

    await page.goto("/arena/showcase");
    await expect(page.getByRole("main").getByText(DISPLAY_NAME_PARTICIPANT).first()).toBeVisible();

    await page.goto("/app/profile");
    const withdraw = page.getByRole("button", { name: "Cabut izin tampil" });
    await expect(withdraw).toBeVisible();
    await withdraw.click();
    await expect(page.getByText(/Izin dicabut/i)).toBeVisible();

    await page.goto("/arena/showcase");
    await expect(page.getByRole("main").getByText(DISPLAY_NAME_PARTICIPANT)).toHaveCount(0);
  });

  test("account deletion is behind a typed confirmation and says what survives", async ({ page }) => {
    await page.goto("/app/profile");
    // Same hydration wait as above, via a control whose disabled state tracks it.
    await expect(page.getByRole("button", { name: /tampil di Showcase/ })).toBeEnabled();
    await page.getByRole("button", { name: "Saya ingin menghapus akun" }).click();

    const confirm = page.getByRole("button", { name: "Hapus akun permanen" });
    await expect(confirm).toBeDisabled();
    // The copy must not promise a hard delete it cannot perform.
    await expect(page.getByText(/Poin, peringkat minggu yang sudah difinalisasi/i)).toBeVisible();

    await page.getByLabel(/Ketik/).fill("hapus");
    await expect(confirm).toBeDisabled();
    await page.getByLabel(/Ketik/).fill("HAPUS AKUN");
    await expect(confirm).toBeEnabled();
    // Deliberately NOT clicked: this suite must not delete its own fixture
    // participant out from under the other specs. The guard is what is tested.
  });
});

test.describe("Admin readiness", () => {
  test.use({ storageState: ADMIN_STATE });

  test("the overview leads with actionable automation health, not just a queue count", async ({ page }) => {
    await page.goto("/app/admin");
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
    await expect(page.getByText("Kesehatan otomasi")).toBeVisible();
    // Heartbeats and the email backlog are the facts that distinguish "quiet"
    // from "stopped", which a queue depth of zero cannot.
    await expect(page.getByText(/Heartbeat:/)).toBeVisible();
    await expect(page.getByText(/Outbox email:/)).toBeVisible();
    await expect(page.getByText(/Pemindaian CV jam ini:/)).toBeVisible();
  });

  test("the jobs source page shows health, freshness and a manual trigger", async ({ page }) => {
    await page.goto("/app/admin/careers");
    await expect(page.getByRole("heading", { name: "Sumber lowongan" })).toBeVisible();
    await expect(page.getByText("Sumber uji lokal")).toBeVisible();
    await expect(page.getByRole("button", { name: "Tarik sekarang" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Nonaktifkan" })).toBeVisible();
    await expect(page.getByText(/setiap 60 menit/)).toBeVisible();
  });

  test("jobs-sync appears as a runnable scheduled job", async ({ page }) => {
    await page.goto("/app/admin/jobs");
    await expect(page.getByText("Tarik lowongan")).toBeVisible();
  });
});

test.describe("Error and retry states", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("a signed-out visitor is not shown someone else's career data", async ({ page }) => {
    // The failure this prevents is not a crash: it is a page that renders an
    // empty-but-plausible report to a stranger.
    const response = await page.goto("/app/jobs");
    expect(response?.status()).toBeLessThan(500);
    await expect(page.getByText("Junior Data Analyst")).toHaveCount(0);
  });

  test("the jobs API refuses an unauthenticated read", async ({ request }) => {
    const response = await request.get("/api/career/jobs");
    expect(response.status()).toBe(401);
  });

  test("the admin jobs-source API refuses a participant session", async ({ browser }) => {
    const context = await browser.newContext({ storageState: path.join(process.cwd(), "e2e-local", ".auth", "state.json") });
    try {
      const response = await context.request.get("/api/internal/admin/job-sources");
      // A participant is authenticated but not authorised: 403, and no data.
      expect(response.status()).toBe(403);
      expect(await response.text()).not.toContain("Sumber uji lokal");
    } finally {
      await context.close();
    }
  });
});
