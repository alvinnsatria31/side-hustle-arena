# Browser suite — isolated sandbox

Playwright, Chromium, one worker, against loopback Postgres and MinIO. Needs no
shared environment, no cloud database, no live bucket and no credentials.

```bash
node scripts/local-dev.mjs --setup-only   # containers + migrations + seed
npm run test:browser:local
npx playwright test --config playwright.sandbox.config.ts --headed
```

## Why this exists alongside `e2e/`

`e2e/` (`playwright.config.ts`) loads `.env` and therefore drives the shared
cloud development database and the real Tencent COS bucket. That makes it
valuable — it is the only suite that proves the live storage path — and also
unsuitable as the check you run before every commit: it writes to an environment
other people share, and it skips specs unless a live bucket's CORS rule is in
place.

This suite trades that away deliberately. `localEnvironment()` refuses anything
that is not a loopback `arena_local` database, blanks every external credential,
and turns the AI providers off, so a spec here **cannot** reach a provider even
if it asked to. The fixture also refuses to connect to any non-loopback host.

## What it covers

| File | Covers |
|---|---|
| `career.spec.ts` | Jobs (live openings, provenance and freshness, closed openings excluded, coverage labelling, filters, the outbound application link), Career Report (measured vs unmeasured skill evidence, history links), Arena project browsing, CV scanner in its disabled state. |
| `privacy-and-admin.spec.ts` | Showcase consent granted and withdrawn end to end, account-deletion confirmation guard, admin automation health, admin jobs sources, and the signed-out / wrong-scope error paths. |

## Fixture

`globalSetup` seeds one open week with a live project, one finalized week with a
scored result and criterion-attributed skill evidence, a jobs source with one
open and one closed opening, and two users (participant + admin). Everything is
prefixed `E2EL-`; `globalTeardown` removes all of it, pass or fail.

Two fixture details are load-bearing:

- **`avatar_id` is set.** A null one raises the one-time avatar picker, a modal
  that covers the page and intercepts every click.
- **The display name comes from the token, not the seed row.**
  `provisionParticipant` derives `display_name_cache` from the JWT's
  `firstName` on every request, so the token decides what a page shows.

## Signing in

Minted, not performed. The Arena verifies the Sekolah Karir participant cookie
but cannot issue one, and the main site is a separate application, so the
fixture signs its own `sk_participant` with the sandbox `SESSION_SECRET` — the
same token shape a real login hands the browser. Everything downstream of the
cookie is the real path. Real SSO remains out of scope for any local suite.

## Writing a spec here

Two things bite repeatedly:

1. **Wait for hydration, not just visibility.** These pages render server-side
   and their controls are disabled until client data loads. A click before
   hydration lands on markup React has not adopted and silently does nothing —
   `await expect(button).toBeEnabled()` first.
2. **Scope assertions to `main`.** The signed-in header carries the visitor's
   own name, so a page-wide text assertion can match the chrome instead of the
   content under test.
