import { expect, test } from "@playwright/test";
import { PROJECT_SLUG } from "./fixtures";

/**
 * Reduced motion must not cost a participant the content.
 *
 * The whole suite runs with `reducedMotion: "reduce"` (see
 * playwright.sandbox.config.ts), which is what surfaced the bug the audit
 * reported: `useReducedMotion()` answers `false` during SSR and `true` on the
 * first client render, so the server wrote `opacity: 0` and a transform onto
 * every Reveal/Entrance wrapper and the client wrote neither. React reports that
 * as a hydration mismatch and does NOT repair style attributes, so the elements
 * could stay invisible — for exactly the people who asked for less motion.
 *
 * Two assertions, because either alone would pass over the failure: the console
 * must be free of hydration complaints, and the content those wrappers hold must
 * actually be on screen.
 */

/** React phrases the mismatch several ways across versions; match all of them. */
const HYDRATION = /hydrat|did not match|server rendered|server HTML/i;

function collectHydrationComplaints(page: import("@playwright/test").Page): string[] {
  const seen: string[] = [];
  page.on("console", (message) => {
    if (message.type() !== "error" && message.type() !== "warning") return;
    if (HYDRATION.test(message.text())) seen.push(message.text());
  });
  page.on("pageerror", (error) => {
    if (HYDRATION.test(error.message)) seen.push(error.message);
  });
  return seen;
}

const PAGES: Array<{ path: string; name: string }> = [
  // The public pitch is the densest use of these wrappers on the site — every
  // section, every card and every illustration sits inside one — so it is the
  // page where a stuck Reveal costs the most and shows up first.
  { path: "/", name: "public landing page" },
  { path: "/arena", name: "Arena landing" },
  { path: "/arena/projects", name: "public project list" },
  { path: `/arena/projects/${PROJECT_SLUG}`, name: "public project brief" },
  { path: "/app/arena", name: "participant Arena home" },
  { path: `/app/arena/projects/${PROJECT_SLUG}`, name: "participant project brief" },
];

for (const target of PAGES) {
  test(`${target.name} hydrates cleanly with reduced motion, and its content is visible`, async ({ page }) => {
    const complaints = collectHydrationComplaints(page);
    await page.goto(target.path);
    // Wait for hydration to have happened at all: a mismatch is only reported
    // once React has reconciled the server markup on the client.
    await page.waitForLoadState("networkidle");

    const heading = page.getByRole("heading").first();
    await expect(heading).toBeVisible();
    // Visible is not enough on its own — an element inside a stuck Reveal keeps
    // its layout box and reads as visible while `opacity: 0` hides its text.
    await expect(heading).toHaveCSS("opacity", "1");

    expect(complaints, `hydration warnings on ${target.path}:\n${complaints.join("\n")}`).toEqual([]);
  });
}

/**
 * Reduced motion must also mean no motion, not only "ends visible".
 *
 * The checks above pass once the entrance has finished, so they could not see
 * that Reveal/Entrance still played the full fade: the first client render has
 * to match the server (animate), and changing only `transition` afterwards does
 * not re-target a tween already in flight. This samples the landing headline's
 * wrapper while the page settles: under reduced motion it may be hidden (server
 * markup, before hydration) or shown, but never somewhere in between.
 */
test("the landing headline appears without a fade under reduced motion", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const samples = await page.evaluate(async () => {
    const seen: number[] = [];
    const start = performance.now();
    while (performance.now() - start < 2_000) {
      const heading = document.querySelector("h1");
      const wrapper = heading?.closest("[style]") ?? heading;
      if (wrapper) seen.push(Number(getComputedStyle(wrapper).opacity));
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    return seen;
  });
  const between = samples.filter((opacity) => opacity > 0.01 && opacity < 0.99);
  expect(between, `opacity mid-fade: ${between.join(", ")}`).toEqual([]);
  expect(samples.at(-1)).toBe(1);
});
