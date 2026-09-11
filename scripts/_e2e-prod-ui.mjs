// Production E2E, browser half: the tester's pages on the live site, and the
// reward claim made by clicking the button on the Profile page.
//
// Usage:
//   E2E_TOKEN_FILE=... E2E_SHOTS=<dir> E2E_UI_MODE=view|claim [E2E_CLAIM_TITLE=...] node scripts/_e2e-prod-ui.mjs
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const BASE = process.env.E2E_BASE ?? 'https://arena.sekolahkarir.id';
const token = readFileSync(process.env.E2E_TOKEN_FILE, 'utf8').trim();
const shots = process.env.E2E_SHOTS;
const mode = process.env.E2E_UI_MODE ?? 'view';
const claimTitle = process.env.E2E_CLAIM_TITLE ?? 'Template Notion & Resume Starter Kit';

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'id-ID' });
  await context.addCookies([{ name: 'sk_participant', value: token, domain: 'arena.sekolahkarir.id', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' }]);
  const page = await context.newPage();
  const shot = async (name) => { await page.screenshot({ path: join(shots, `${name}.png`), fullPage: true }); console.log(`[ui] screenshot ${name}.png`); };

  if (mode === 'view') {
    await page.goto(`${BASE}/arena`, { waitUntil: 'networkidle' });
    const logoOk = await page.locator('header img[src="/logo.png"]').first().evaluate((img) => img.complete && img.naturalWidth > 0).catch(() => false);
    console.log(`[ui] public navbar logo loaded: ${logoOk}`);
    await page.locator('#hadiah').scrollIntoViewIfNeeded().catch(() => undefined);
    await shot('public-arena');

    await page.goto(`${BASE}/app/arena`, { waitUntil: 'networkidle' });
    await page.getByText('Hadiah & milestone').first().waitFor({ timeout: 20_000 });
    await shot('app-arena-roadmap');

    await page.goto(`${BASE}/app/profile`, { waitUntil: 'networkidle' });
    await page.getByText('Poin terkumpul').first().waitFor({ timeout: 20_000 });
    console.log(`[ui] profile progress: ${(await page.getByText(/Kurang [\d.]+ poin lagi untuk membuka/).first().textContent().catch(() => 'n/a'))?.trim()}`);
    await shot('profile-rewards');

    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'id-ID' });
    await mobile.addCookies([{ name: 'sk_participant', value: token, domain: 'arena.sekolahkarir.id', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' }]);
    const phone = await mobile.newPage();
    await phone.goto(`${BASE}/app/profile`, { waitUntil: 'networkidle' });
    await phone.getByText('Poin terkumpul').first().waitFor({ timeout: 20_000 });
    await phone.screenshot({ path: join(shots, 'profile-mobile.png'), fullPage: false });
    console.log('[ui] screenshot profile-mobile.png');
    await mobile.close();
  } else {
    await page.goto(`${BASE}/app/profile`, { waitUntil: 'networkidle' });
    // A first visit raises the one-time avatar picker over the page; answer it
    // the way a participant would before touching anything behind it.
    const picker = page.getByRole('dialog').filter({ hasText: 'Pilih avatar' });
    if (await picker.isVisible().catch(() => false)) {
      await picker.getByRole('button').nth(1).click();
      await picker.getByRole('button', { name: 'Masuk Arena' }).click();
      await picker.waitFor({ state: 'hidden', timeout: 20_000 });
      console.log('[ui] avatar picked');
    }
    const logoLoaded = await page.waitForFunction(() => {
      const img = document.querySelector('header img[src="/logo.png"]');
      return Boolean(img && img.complete && img.naturalWidth > 0);
    }, null, { timeout: 15_000 }).then(() => true).catch(() => false);
    console.log(`[ui] app navbar logo loaded: ${logoLoaded}`);
    const row = page.locator('#rewards div.flex.flex-wrap.items-center.justify-between').filter({ hasText: claimTitle }).first();
    await row.waitFor({ timeout: 20_000 });
    const button = row.getByRole('button');
    console.log(`[ui] claim button: "${(await button.textContent())?.trim()}" enabled=${await button.isEnabled()}`);
    await button.click();
    await page.getByText(/Reward berhasil diklaim/).first().waitFor({ timeout: 20_000 });
    console.log(`[ui] ${(await page.getByRole('status').first().textContent())?.trim()}`);
    await page.getByText('Sudah diklaim').first().waitFor({ timeout: 20_000 });
    await shot('profile-after-claim');
  }
} finally {
  await browser.close();
}
