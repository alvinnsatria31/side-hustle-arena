import { expect, test } from '@playwright/test';

const TOOLS_URL = 'https://tools.sekolahkarir.id';

/**
 * The highlighted SekolahKarir Tools entry, on every surface that draws the
 * shared link list.
 *
 * The list exists because four hand-kept copies of it once let a link appear
 * in the bar and vanish from the footer. A promoted entry is the case most
 * likely to repeat that: it is added in a hurry, to whichever surface someone
 * happened to be looking at. This asserts all five at once, and that the
 * off-site entry really does open in a new tab rather than navigating the
 * Arena away from itself.
 */
test.describe('signed out', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('public bar and footer carry Tools, pointed off-site', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/arena');

    const bar = page.getByRole('navigation', { name: 'Navigasi utama' });
    const tools = bar.getByRole('link', { name: /Tools/ });
    await expect(tools).toBeVisible();
    await expect(tools).toHaveAttribute('href', TOOLS_URL);
    await expect(tools).toHaveAttribute('target', '_blank');
    // Without noopener the opened tab can reach back through window.opener.
    await expect(tools).toHaveAttribute('rel', /noopener/);

    const footerTools = page.locator('footer').locator(`a[href="${TOOLS_URL}"]`);
    await expect(footerTools).toHaveCount(1);
  });

  test('the mobile sheet carries it too', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto('/arena');
    // The bar is server-rendered, so it is clickable before React has attached
    // the toggle; a single early click lands on nothing. Retry until it opens.
    const button = page.getByRole('button', { name: 'Buka menu' });
    const sheet = page.locator('header > div').last();
    const tools = sheet.getByRole('link', { name: /Tools/ });
    for (let i = 0; i < 5 && (await tools.count()) === 0; i += 1) {
      await button.click();
      await page.waitForTimeout(250);
    }
    await expect(tools).toBeVisible();
  });
});

test.describe('signed in', () => {
  test('the sidebar rail carries it', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/app/arena');
    const rail = page.getByRole('navigation', { name: 'Navigasi Arena' });
    const tools = rail.getByRole('link', { name: /Tools/ });
    await expect(tools).toBeVisible();
    await expect(tools).toHaveAttribute('href', TOOLS_URL);
    await expect(tools).toHaveAttribute('target', '_blank');
  });

  test('so does the small-screen menu', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto('/app/arena');
    const button = page.getByRole('button', { name: /Menu pengguna/ });
    const menu = page.getByRole('menu', { name: 'Menu pengguna' });
    // The menu's toggle is unreliable to drive from a test, and was before this
    // entry existed — the same retry is needed to reach "Profil".
    for (let i = 0; i < 5 && (await menu.count()) === 0; i += 1) {
      await button.click();
      await page.waitForTimeout(250);
    }
    await expect(menu).toBeVisible();
    const tools = menu.locator(`a[href="${TOOLS_URL}"]`);
    await expect(tools).toHaveCount(1);
    await expect(tools).toContainText('Tools');
    await expect(tools).toHaveAttribute('target', '_blank');
  });
});
