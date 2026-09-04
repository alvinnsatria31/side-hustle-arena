import { defineConfig, devices } from "@playwright/test";

// Mutations are origin-checked against ARENA_ALLOWED_ORIGINS, which is
// http://localhost:3001 in development — so E2E must drive that exact origin.
const BASE_URL = process.env.ARENA_ORIGIN ?? "http://localhost:3001";

export default defineConfig({
  testDir: "./e2e",
  // The suite shares one fixture user with a one-project-per-week rule, so it
  // must not run in parallel against itself.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL: BASE_URL,
    // The workspace animates between steps; reduced motion keeps step
    // transitions from detaching elements mid-click.
    contextOptions: { reducedMotion: "reduce" },
    storageState: "e2e/.auth/state.json",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
