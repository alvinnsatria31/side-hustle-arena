// Render cover.html to dist/notion-cover.png (the Notion page banner).
// Run from the repository root: node docs/rewards/notion-resume-kit/render-cover.mjs
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 600 }, deviceScaleFactor: 2 });
  await page.goto(pathToFileURL(path.join(here, "cover.html")).href, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(here, "dist", "notion-cover.png") });
  console.log("wrote dist/notion-cover.png");
} finally {
  await browser.close();
}
