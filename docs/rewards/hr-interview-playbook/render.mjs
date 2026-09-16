/**
 * Render dist/playbook.html to dist/HR-Interview-Cheat-Code-v2.pdf.
 *
 * The render refuses to write a PDF when a page's content overflows its A4 box
 * or when a web font failed to load — the two failures that are invisible in
 * the HTML preview and permanent in the PDF.
 *
 * Run: node docs/rewards/hr-interview-playbook/build.mjs
 *      node docs/rewards/hr-interview-playbook/render.mjs
 */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = path.join(here, "dist", "playbook.html");
const target = path.join(here, "dist", "HR-Interview-Cheat-Code-v2.pdf");

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 1200 } });
  const failures = [];
  page.on("pageerror", (error) => failures.push(`page error: ${error.message}`));
  page.on("requestfailed", (request) => failures.push(`request failed: ${request.url()}`));

  await page.goto(pathToFileURL(source).href, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);

  const report = await page.evaluate(() => {
    // Ask the font set itself: checking by CSS shorthand reports "missing" for a
    // family that loaded only in the weights the book actually uses.
    const families = ["Manrope", "Plus Jakarta Sans", "JetBrains Mono"];
    const loadedFaces = [...document.fonts].filter((face) => face.status === "loaded");
    const fonts = families.map((family) => ({
      family,
      loaded: loadedFaces.some((face) => face.family.replace(/"/g, "") === family),
    }));

    const pages = [...document.querySelectorAll(".page")].map((section, i) => {
      const inner = section.querySelector(".inner");
      const box = inner.getBoundingClientRect();
      // Deepest element bottom edge, so a card that spills past the padding box
      // is caught even when the container itself does not scroll.
      let lowest = 0;
      let widest = 0;
      for (const node of inner.querySelectorAll("*")) {
        const rect = node.getBoundingClientRect();
        if (rect.height === 0 && rect.width === 0) continue;
        lowest = Math.max(lowest, rect.bottom - box.top);
        widest = Math.max(widest, rect.right - box.left);
      }
      // Widest gap between two stacked blocks: the page spreads its leftover
      // space, so a large gap means the page is short of content, not that the
      // spacing was designed that way.
      const content = section.querySelector(".content");
      let gap = 0;
      if (content) {
        const children = [...content.children];
        for (let n = 0; n < children.length - 1; n += 1) {
          const here = children[n].getBoundingClientRect();
          const next = children[n + 1].getBoundingClientRect();
          gap = Math.max(gap, next.top - here.bottom);
        }
      }

      return {
        page: i + 1,
        vertical: Math.round(lowest - box.height),
        horizontal: Math.round(widest - box.width),
        scroll: Math.round(inner.scrollHeight - inner.clientHeight),
        gap: Math.round(gap),
      };
    });

    return { fonts, pages, count: pages.length };
  });

  for (const font of report.fonts) {
    if (!font.loaded) failures.push(`font not loaded: ${font.family}`);
  }
  for (const entry of report.pages) {
    if (entry.vertical > 1) failures.push(`page ${entry.page}: content overflows bottom by ${entry.vertical}px`);
    if (entry.horizontal > 1) failures.push(`page ${entry.page}: content overflows right by ${entry.horizontal}px`);
  }

  if (failures.length) {
    console.error(`FAILED (${failures.length}):`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exitCode = 1;
  } else {
    await page.pdf({
      path: target,
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    const airy = report.pages.filter((entry) => entry.gap > 70);
    console.log(`wrote dist/HR-Interview-Cheat-Code-v2.pdf — ${report.count} pages, no overflow`);
    if (airy.length) {
      console.log(`  thin pages (largest gap between blocks): ${airy.map((e) => `p${e.page}:${e.gap}px`).join(", ")}`);
    }
  }
} finally {
  await browser.close();
}
