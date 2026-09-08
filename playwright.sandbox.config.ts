import { defineConfig, devices } from "@playwright/test";
import { localEnvironment } from "./scripts/local-env.mjs";

/**
 * Browser coverage against the isolated local sandbox.
 *
 * Separate from `playwright.config.ts` on purpose. That suite loads `.env` and
 * therefore drives the shared cloud development database and the real object
 * store; it also skips its upload specs unless a live bucket's CORS rule is in
 * place. This one runs entirely on loopback Postgres and MinIO, so it can be
 * run by anyone, at any time, without touching a shared environment — which is
 * what makes it usable as the routine local check.
 *
 *   npm run test:browser:local
 *
 * `localEnvironment()` refuses to produce anything but a loopback `arena_local`
 * configuration and blanks every external credential, so this suite cannot
 * reach a provider even if a spec asked it to.
 */
const env = localEnvironment();
for (const [key, value] of Object.entries(env)) process.env[key] = String(value);

const BASE_URL = env.ARENA_ORIGIN;

export default defineConfig({
  testDir: "./e2e-local",
  // One fixture participant, one project per week: the rule under test would be
  // violated by the suite itself if it ran in parallel against itself.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  // A dev server compiles each route on first request; these budgets are sized
  // for that, and are never approached against a production build.
  timeout: 180_000,
  expect: { timeout: 20_000 },
  reporter: [["list"]],
  globalSetup: "./e2e-local/global-setup.ts",
  globalTeardown: "./e2e-local/global-teardown.ts",
  use: {
    baseURL: BASE_URL,
    contextOptions: { reducedMotion: "reduce" },
    storageState: "e2e-local/.auth/state.json",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node scripts/playwright-sandbox-server.mjs",
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
