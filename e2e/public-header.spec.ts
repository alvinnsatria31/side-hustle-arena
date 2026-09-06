import { expect, test } from "./test-fixtures";

/**
 * The public pages do not require a session, but they must recognise one.
 *
 * The session is shared across the domain, so someone who signed in on the main
 * site already holds the cookie when they land here. Showing them "Masuk" was
 * the whole of the confusion — nothing was asking them to sign in twice, the
 * header just never looked.
 */
test.describe("public header, signed in", () => {
  test("shows the participant instead of a sign-in prompt", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("button", { name: /Menu pengguna/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Buka Arena" })).toBeVisible();
    // The point of the fix: no invitation to do what they have already done.
    await expect(page.getByRole("link", { name: "Masuk", exact: true })).toHaveCount(0);
  });

  test("the menu opens onto their profile and a way out", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Menu pengguna/ }).click();

    const menu = page.getByRole("menu", { name: "Menu pengguna" });
    await expect(menu.getByRole("menuitem", { name: "Profil" })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Keluar" })).toBeVisible();
  });
});

test.describe("public header, signed out", () => {
  // A visitor with no cookie at all — the state the header used to show everyone.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("still offers a way to sign in", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("link", { name: "Masuk", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Menu pengguna/ })).toHaveCount(0);
  });
});
