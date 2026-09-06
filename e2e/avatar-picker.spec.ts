import { AUTH_SUBJECT } from "./fixture-db";
import { expect, test } from "./test-fixtures";

/**
 * Arrival from the main site.
 *
 * A participant who signed in on sekolahkarir.id is already authenticated here —
 * the session cookie is shared across the domain — so the Arena asks them for
 * exactly one thing: the avatar the leaderboard shows. `avatar_id` being null is
 * the whole trigger, so each test here clears it and puts it back, leaving the
 * shared fixture user the way the rest of the suite expects to find them.
 */
test.describe("avatar on arrival", () => {
  test.beforeEach(async ({ db }) => {
    await db`update identity.users set avatar_id = null where auth_subject = ${AUTH_SUBJECT}`;
  });

  test.afterEach(async ({ db }) => {
    await db`update identity.users set avatar_id = 'rocket' where auth_subject = ${AUTH_SUBJECT}`;
  });

  test("asks once, cannot be walked past, and does not ask again", async ({ page, db }) => {
    await page.goto("/app");

    const picker = page.getByRole("dialog");
    await expect(picker).toBeVisible();
    await expect(picker.getByText("Pilih avatar kamu.")).toBeVisible();

    // The one step between arriving and using the Arena. Escape and a backdrop
    // click must not dismiss it, or someone lands on the leaderboard with no
    // identity and no prompt to fix it.
    await page.keyboard.press("Escape");
    await expect(picker).toBeVisible();

    await picker.getByRole("radio", { name: "Api" }).click();
    await expect(picker.getByRole("radio", { name: "Api" })).toHaveAttribute("aria-checked", "true");
    await picker.getByRole("button", { name: "Masuk Arena" }).click();

    await expect(picker).toBeHidden();
    const [saved] = await db`select avatar_id from identity.users where auth_subject = ${AUTH_SUBJECT}`;
    expect(saved.avatar_id).toBe("fire");

    // The choice shows up in the navbar without a reload, then survives one.
    await expect(page.getByTitle("Api").first()).toBeVisible();
    await page.reload();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByTitle("Api").first()).toBeVisible();
  });

  test("a signed-in participant is never asked to sign in again", async ({ page }) => {
    // The point of the shared session: arriving with a main-site cookie lands on
    // the protected app, not on the sign-in card.
    await page.goto("/app");
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByRole("dialog").getByText("Pilih avatar kamu.")).toBeVisible();
    await expect(page.getByRole("button", { name: /Masuk dengan/ })).toHaveCount(0);
  });
});
