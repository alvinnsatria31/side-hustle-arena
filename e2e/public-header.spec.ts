import { expect, test } from "./test-fixtures";

/**
 * The browsable public pages do not require a session, but they must recognise
 * one.
 *
 * The session is shared across the domain, so someone who signed in on the main
 * site already holds the cookie when they land here. Showing them "Masuk" was
 * the whole of the confusion — nothing was asking them to sign in twice, the
 * header just never looked.
 *
 * These assertions moved from `/` to `/arena` when the landing page was rebuilt
 * around the live week: `/` now carries its own single-door header (covered
 * below) and `PublicNavbar` serves the pages behind it. The behaviour being
 * protected has not changed, only where it lives.
 */
test.describe("public navbar, signed in", () => {
  test("shows the participant instead of a sign-in prompt", async ({ page }) => {
    await page.goto("/arena");

    await expect(page.getByRole("button", { name: /Menu pengguna/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Buka Arena" })).toBeVisible();
    // The point of the fix: no invitation to do what they have already done.
    //
    // Scoped to the bar. This used to query the whole page, which also caught
    // the footer's "Masuk" entry — the footer is a server component with no
    // session, so it lists that link for everyone and the assertion could not
    // hold as written. The header is what the fix was about.
    await expect(page.getByRole("banner").getByRole("link", { name: "Masuk", exact: true })).toHaveCount(0);
  });

  test("the menu opens onto their profile and a way out", async ({ page }) => {
    await page.goto("/arena");
    await page.getByRole("button", { name: /Menu pengguna/ }).click();

    const menu = page.getByRole("menu", { name: "Menu pengguna" });
    await expect(menu.getByRole("menuitem", { name: "Profil" })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Keluar" })).toBeVisible();
  });
});

test.describe("public navbar, signed out", () => {
  // A visitor with no cookie at all — the state the header used to show everyone.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("still offers a way to sign in", async ({ page }) => {
    await page.goto("/arena");

    await expect(
      page.getByRole("banner").getByRole("link", { name: "Masuk", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /Menu pengguna/ })).toHaveCount(0);
  });
});

/**
 * The landing header is one door, and it has to be the same door in both
 * states.
 *
 * Its whole design argument is that a stranger should have exactly one thing to
 * click. That only holds if the button goes somewhere for everyone: straight to
 * the dashboard with a session, and through the Sekolah Karir sign-in that
 * continues to the same dashboard without one. A landing page that quietly
 * sends signed-out visitors to `/app` — or signed-in ones back through a login
 * they already passed — is the failure this covers.
 */
test.describe("landing header", () => {
  test("sends a signed-in visitor straight into the Arena", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("link", { name: "Masuk Arena" }).first()).toHaveAttribute(
      "href",
      "/app/arena",
    );
  });

  test("names the family without linking to what is not deployed", async ({ page }) => {
    await page.goto("/");
    const header = page.getByRole("banner");

    await expect(header.getByRole("link", { name: "Sekolah Karir", exact: true })).toBeVisible();
    await expect(header.getByRole("link", { name: "Kontak" })).toHaveAttribute("href", "#kontak");
    // Career is named because people ask what else exists; it is not a link
    // because it is not deployed.
    await expect(header.getByText("Sekolah Karir Career")).toBeVisible();
    await expect(header.getByRole("link", { name: /Sekolah Karir Career/ })).toHaveCount(0);
  });

  test("keeps the Arena's internal surfaces out of the landing header", async ({ page }) => {
    await page.goto("/");
    const header = page.getByRole("banner");

    for (const href of ["/arena/projects", "/arena/showcase", "/app/store"]) {
      await expect(header.locator(`a[href="${href}"]`)).toHaveCount(0);
    }
  });

  test("the contact link reaches the footer's help block", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Kontak" }).first().click();

    await expect(page.locator("#kontak")).toBeInViewport();
  });
});

test.describe("landing header, signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("routes through Sekolah Karir sign-in and back to the Arena", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("link", { name: "Masuk Arena" }).first()).toHaveAttribute(
      "href",
      "/login?returnTo=%2Fapp%2Farena",
    );

    await page.getByRole("link", { name: "Masuk Arena" }).first().click();
    // No Arena login of its own: the only option is the main site's account.
    await expect(page.getByRole("button", { name: "Masuk dengan akun Sekolah Karir" })).toBeVisible();
  });
});
