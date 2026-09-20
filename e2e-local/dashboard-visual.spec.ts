import { expect, test } from '@playwright/test';

/**
 * The participant dashboard, at the three widths it has to survive.
 *
 * These are layout assertions, not content ones: the redesign packs the hero,
 * four stat tiles and two card grids into a column that was previously one
 * stacked list, and the two ways that breaks are a tile clipping its own
 * caption and the page growing a horizontal scrollbar on a phone. Both are
 * invisible in a passing content test and obvious to whoever opens the page.
 */
const widths = [
  { name: 'mobile', width: 390, height: 900 },
  { name: 'tablet', width: 834, height: 1100 },
  { name: 'desktop', width: 1280, height: 1000 },
];

test.describe('participant dashboard', () => {
  for (const size of widths) {
    test(`lays out at ${size.name}`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto('/app/arena');

      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByLabel('Ringkasan capaian')).toBeVisible();
      await expect(page.getByLabel('Pintasan')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Proyekku' })).toBeVisible();

      // No stat tile hides part of its own caption.
      const clipped = await page.evaluate(
        () =>
          Array.from(document.querySelectorAll('[aria-label="Ringkasan capaian"] a')).filter(
            (el) => el.scrollHeight > el.clientHeight + 1,
          ).length,
      );
      expect(clipped).toBe(0);
    });
  }

  test('does not scroll sideways on a small phone', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    await page.goto('/app/arena');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('the enrollment card reads the same on Proyekku', async ({ page }) => {
    await page.goto('/app/arena/my-projects');
    await expect(page.getByRole('heading', { name: 'Proyekku', level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Dashboard operasional' })).toBeVisible();
    // The finalised sprint shows its score row rather than a progress track.
    await expect(page.getByText('Hasil tersedia').first()).toBeVisible();
  });
});
