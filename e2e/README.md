# Browser end-to-end suite

Playwright, Chromium, one worker. Drives the real UI against the live
development database and the private Tencent COS bucket.

```bash
npm run test:e2e:browser            # whole suite
npx playwright test --headed        # watch it run
npx playwright show-report          # last HTML report
```

`globalSetup` creates its own week, division, project (with one FILE and one
LINK requirement) and user, then mints a session cookie into
`e2e/.auth/state.json`. `globalTeardown` deletes all of it. The seeded
`DEV-ARENA-CORE-*` fixtures are never touched.

The suite needs the app on `http://localhost:3001` — the only origin in
`ARENA_ALLOWED_ORIGINS`, so mutations are rejected anywhere else. Playwright
reuses a dev server if one is already running and starts one otherwise.

## Environment it needs

Bucket CORS is configured (browser preflight PUT answers 200), so
`uploading a file...` and `the submitted file downloads...` run live — no
skips. If they start skipping with "Gagal menyimpan", re-check the bucket
CORS rule:

| Field | Value |
|---|---|
| Origin | `http://localhost:3001` (plus the production origin later) |
| Methods | `GET`, `PUT`, `HEAD` |
| Allowed headers | `content-type` |
| Exposed headers | `ETag` |
| Max age | `600` |

`globalSetup` re-probes the bucket on every run.

**Signing in happens on the main site.** The Arena verifies the Sekolah Karir
participant cookie but cannot issue one, and `sekolah-karir-website` is a
separate application. `fixture-db.ts` therefore signs its own `sk_participant`
with the shared `SESSION_SECRET` — the same token shape a real login hands the
browser, so everything downstream of the cookie is the real path.

`SESSION_SECRET` must be set for the suite to run: without it the app treats
every request as signed out and the whole suite fails at the first page.
`playwright.config.ts` and `scripts/playwright-dev-server.mjs` tolerate the
local typo `SSESSION_SECRET` by mapping it for this suite only; production and
manual local runs should use the canonical `SESSION_SECRET` key.

## Known product gap recorded by this suite

`enrolling from the project detail UI` passes: the CTA reads the live session
(`getCurrentEnrollment()`) instead of the localStorage demo store, so a
signed-in user enrolls instead of getting the login modal. The old
`test.fail()` marker is gone; the stale comment at the top of
`arena-flow.spec.ts` still mentions it.

The other specs enrol through the API to get past this.

## Active local coverage

The local/pre-production suite now covers sealed local review, local
finalization result, leaderboard UI, and milestone reward redemption in
addition to enrollment, workspace, upload/download, and submit.

## Placeholders

`Arena end-to-end: external dependencies` keeps the two intentionally skipped
browser gaps visible: real SSO from the separate main website and real external
AI review. Those need the paired external apps/services before they can have
honest assertions.
