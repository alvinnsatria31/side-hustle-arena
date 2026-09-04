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

## Blocked — needs action outside this repo

**1. Bucket CORS is not configured.** The browser uploads by PUTting straight to
Tencent COS, and the bucket answers the preflight with `403` and no
`Access-Control-Allow-Origin`. Every browser upload therefore fails with
"Gagal menyimpan", while the Node suites pass because Node does not enforce
CORS. Until a rule exists, `uploading a file...` and `the submitted file
downloads...` skip with this reason.

Add a bucket CORS rule allowing:

| Field | Value |
|---|---|
| Origin | `http://localhost:3001` (plus the production origin later) |
| Methods | `GET`, `PUT`, `HEAD` |
| Allowed headers | `content-type` |
| Exposed headers | `ETag` |
| Max age | `600` |

`globalSetup` re-probes the bucket on every run, so those two tests start
running by themselves once the rule is live — no code change needed.

**2. Real SSO login is not exercised.** The canonical auth server on `:3000` is
a separate codebase that does not run on this machine, so the session is minted
directly in `fixture-db.ts` and kept alive by pushing
`last_canonical_check_at` forward (otherwise revalidation revokes it after
`ARENA_SSO_INTROSPECTION_INTERVAL_SECONDS`). When canonical is reachable in CI,
replace the mint with a real login and delete `refreshSessionCheckpoint`.

## Known product gap recorded by this suite

`enrolling from the project detail UI` is marked `test.fail()`. `ProjectDetail`
gates enrolment on `state.user` from the localStorage demo store (`useDemo`),
which never learns about the real session cookie — a genuinely signed-in user
gets the login modal instead of an enrolment. `ArenaSessionProvider` exists for
this migration but `ProjectDetail` has not moved onto it. When it does,
Playwright reports "passed unexpectedly"; delete the `test.fail()` line then.

The other specs enrol through the API to get past this.

## Placeholders

`Arena end-to-end: not yet coverable` holds one `fixme` per piece of the flow
that has no honest assertion yet: real SSO, AI review (still `stub-dev-v1`),
finalization (Friday scheduler not live), leaderboard UI (mock), and reward
redemption (no UI). They are listed in every run so the gap stays visible.
