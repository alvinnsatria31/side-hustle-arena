# Arena End-to-End Implementation

Latest checkpoint: [VPS integration audit, 2026-09-06](VPS_INTEGRATION_AUDIT_2026-09-06.md). SSH access verified; live grading uses the old payload despite its new endpoint, and generation/release still target legacy Supabase. Current local storage and automation variables are missing. Earlier verification below is historical, not proof of today's live configuration.

Completed 2026-09-06: runtime inventory verified read-only DB/schema, AI model listing HTTP 200, production API HTTP 404, local session-secret mismatch, empty inventory, and generation cron/window mismatch. Fresh focused tests passed 7/7. No external mutations. Owner inputs pending: canonical admin account, payout method/stock policy, COS configuration location, target Vercel project. Details and exact verification limits are in the linked audit.

Current handoff and audit status is canonical in `docs/backend/CODEX_HANDOFF_AUDIT_2026-09-06.md`. It records the latest passing checks, remaining production blockers, and a ready-to-paste continuation prompt. Earlier completion notes below are historical checkpoints, not a claim that production is complete.

## Operator Checklist Before Production

The implementation is ready for the following owner-operated gates; no credential value should be sent in chat or committed.

1. **SSO:** identify the canonical main-site production session scheme. If `sk_participant` is already an HS256 cookie scoped to `sekolahkarir.id`, align Arena's production `SESSION_SECRET` and `COOKIE_DOMAIN=sekolahkarir.id` exactly, then provide a staging participant account for the cross-site browser test. If the main-site cookie is host-only or `__Host-` prefixed, do not widen it; authorize a PKCE/authorization-code bridge implementation in the main-site repository instead.
2. **n8n grading:** provide read/edit access to a staging copy of the live workflow or a redacted export. Provision separate `INTERNAL_AUTOMATION_TOKEN` (claim/complete/fail worker API), `ARENA_EVAL_TOKEN` (legacy external ingest only), and `VPS_WEBHOOK_TOKEN` (Arena outbound events). The workflow must claim a job, evaluate only its returned blind input, then complete or fail that same `{ jobId, workerId }` lease. Never reuse the tokens across directions.
3. **Vercel and Neon:** name the production Vercel project and Neon branch/database, grant the required operator access, take a verified backup, provision the production variables from `.env.example`, and explicitly authorize the reviewed migration order (including Arena `0007` and `0008`). A deploy must stay behind maintenance/feature flags until smoke checks, logs, cron, rollback, and monitoring have been verified.
4. **Email, storage, and reward operations:** verify the Resend domain/sender and give Arena its own `RESEND_API_KEY` plus `ARENA_FROM_EMAIL`; create the private Tencent COS bucket/CAM identity/CORS policy described in `TENCENT_COS_SETUP.md`; decide the USD 20 fulfillment provider, owner, stock quantity, budget, identity/KYC policy, and manual reversal process. Live email, real object writes, and payout require explicit go-live authorization.

### SSO Validation Runbook

#### Preparing Staging For SSO

1. Create or identify a non-production deployment for the main Sekolah Karir website. Prefer a stable staging subdomain such as `https://staging.sekolahkarir.id`; a Vercel preview URL is acceptable only for an early smoke test.
2. Create or identify a non-production deployment for Arena. Prefer `https://arena-staging.sekolahkarir.id`; a Vercel preview URL is acceptable until DNS is ready.
3. Make both staging apps use HTTPS. Cross-site cookies and OAuth-style redirects should not be validated over plain HTTP.
4. In the main-site staging environment, set the same canonical `SESSION_SECRET` that Arena staging will use, and configure the participant session cookie as `sk_participant` when using the current shared-cookie path.
5. In Arena staging, set `SESSION_SECRET`, `COOKIE_DOMAIN=sekolahkarir.id`, `SK_AUTH_ORIGIN=<main-site staging origin>`, `ARENA_ORIGIN=<arena staging origin>`, and `ARENA_ALLOWED_ORIGINS=<main-site staging origin>,<arena staging origin>`.
6. Create one staging participant account on the main site. Do not use a production customer account for the first cross-site test.
7. If the main-site cookie is host-only or `__Host-` prefixed, stop the shared-cookie setup and use an authorization-code/PKCE bridge instead.

1. On a staging main-site login, inspect the browser cookie. Record only its name, domain, `Secure`, `HttpOnly`, `SameSite`, and whether it has a `__Host-` prefix; never copy its value. The compatible current path is `sk_participant`, domain `sekolahkarir.id`, `Secure`, `HttpOnly`, and `SameSite=Lax`.
2. In main-site and Arena staging deployment settings, set the canonical key name `SESSION_SECRET` from the same protected secret source. Do not retain the local `SSESSION_SECRET` typo outside the Playwright compatibility launcher. Set Arena `COOKIE_DOMAIN=sekolahkarir.id`, `SK_AUTH_ORIGIN=<main-site origin>`, `ARENA_ORIGIN=<arena origin>`, and allow the exact staging origins.
3. In a fresh incognito browser, log in on the main site, then open Arena through `/arena/enter`. Verify the participant identity, enrollment/workspace access, and a protected Arena API request without a second login.
4. Sign out from Arena. Confirm the main site and a newly opened Arena page now both require sign-in. Repeat on a second browser/device. A host-only or `__Host-` main-site cookie is a stop condition: keep it host-only and implement the documented authorization-code/PKCE bridge rather than widening the cookie domain.

## Completed 2026-09-06: Pre-Production Browser E2E

The stale browser placeholders for local Arena completion were replaced with active Playwright coverage. The suite now drives a participant through the real UI and development DB for browse/detail, enrollment/workspace, live COS upload/download, link submission, sealed local review, local finalization result, leaderboard, and milestone reward redemption.

Implementation details:

- `e2e/fixture-db.ts` now has stronger fixture cleanup plus helpers for submitted fixtures, finalized fixtures, read-only review-state lookup, and a deterministic milestone reward SKU.
- `e2e/arena-flow.spec.ts` now asserts sealed feedback before finalization, unsealed final result after local finalization, leaderboard rank/points, and reward redemption status.
- `playwright.config.ts` loads `.env` for the web server and calls `scripts/playwright-dev-server.mjs`, which maps the local typo `SSESSION_SECRET` to `SESSION_SECRET` for Playwright only. Production/manual env should use the canonical `SESSION_SECRET` key.
- Unused browser/helper/admin imports from this pass were removed.

Verification from this pass: `npm run test:e2e:browser` exit 0 with 13 passed and 2 skipped; `npx playwright test e2e/arena-flow.spec.ts -g "local AI review|sealed result|leaderboard|milestone"` exit 0 with 4/4; `npm run typecheck` exit 0; `npm run lint` exit 0 with 0 errors and 15 warnings; `npm run db:check` exit 0; `npm run build` exit 0.

Still not production-complete: real SSO from the separate main website and real external AI review remain skipped; production deployment/migrations/env/monitoring, n8n claim/lease workflow, live email send, live payout, and production smoke tests still require operational authorization.

## Completed 2026-09-06 (later session): Finalization Cleanup And Real Lint Coverage

Handoff blockers 1 and 5 are closed. Blocker 2 was later narrowed by the browser E2E pass above. Blockers 3 and 4 are untouched.

**Blocker 1 — `test:e2e:finalize` cleanup.** `arena.review_artifacts` (migration 0007) hangs off `submission_versions`, not off `reviews`, so it survived the review deletes and blocked `delete from arena.submission_versions`. Cleanup now deletes artifacts per version, and also deletes `arena.skill_evidence` per review — that table is empty for this fixture (the project maps no skills) but would block the reviews delete on any skilled project. Three leftover `E2E-FIN-*` weeks from earlier aborted runs were audited and purged from the development database with a dry-run-first script scoped to `week_code like 'E2E-FIN-%'` plus its `e2e-fin-%` users, `e2e-fin-div-%` divisions and `e2e-mile-150-%` SKUs; 125 rows removed, nothing outside that scope touched. `npm run test:e2e:finalize` now exits 0 (1/1) and leaves no residue.

**Blocker 5 — ESLint TypeScript coverage.** `eslint.config.mjs` was ignores-only, so `npm run lint` passed without reading an application file. It now composes `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript` per `node_modules/next/dist/docs/01-app/03-api-reference/05-config/03-eslint.md`. ESLint 9.18 predates the `eslint/config` export used in that doc, so the config stays a plain array rather than `defineConfig`.

First real run: 27 problems, 10 errors. Now 14 problems, 0 errors, `npm run lint` exits 0.

Resolved by scoping, not suppression:

- `@next/next/no-assign-module-variable` and `react-hooks/rules-of-hooks` fired on `scripts/**` and `e2e/**`, which are Node and Playwright code — the hooks rule reads Playwright's `use` fixture as a hook. Those globs now opt out of the React/Next rules.
- `@typescript-eslint/no-unused-vars` now honours this repo's existing `_` prefix convention, clearing `_request` and `_storageKey`.

Real findings fixed:

- `LoginModal` accepted a documented `onContinue` prop and never called it, while `ProjectDetail` passed one intending to enroll after login. `establish()` hands the browser to the SSO route, so that callback could never run. Both the prop and the dead call site are removed; post-login enrollment has to happen on the `returnTo` page. **This is a functional gap, not just dead code — nothing currently enrols a participant after they log in from the project page.**
- Dead state `projectTitle` on the result page: fetched from the project detail, stored, never rendered. Removed. The result header shows "Great work." and never names the project — worth a product decision.
- Unused imports and a vestigial `select` removed from `scripts/arena-core-live.test.mjs`, `scripts/phase4s-attack.test.mjs`, the career report page and the demo store; one stale `eslint-disable` directive removed from the workspace page.

Deliberately left as warnings, with reasons:

- `react-hooks/set-state-in-effect` (8 sites) is newly enabled in the React Compiler-era hooks plugin. The sites are hydration gates (`store.tsx`, career report), external-store syncs (`ProjectDetail`, `CvUploadView`, `participant-client`), route-change resets (both navbars) and a reduced-motion shortcut (`ScoreRing`). Each needs a considered React change; making them errors on day one would have blocked the gate on pre-existing code. Downgraded to `warn` in the config with that rationale inline.
- `react-hooks/exhaustive-deps` (3) and `@next/next/no-location-assign-relative-destination` (2). The latter two both navigate to root-absolute paths (`/`, `/auth/login?...`), which is safe here.
- The browser suite still needed a focused follow-up at this checkpoint; see the pre-production browser E2E section above for the later result.

Verification, all run after the edits: `test:e2e:finalize` 1/1, `test:arena:core` 9/9, `test:phase4s:attack` 7/7, `test:notifications` 10/10, `test:scheduler:projects` 12/12, `typecheck` exit 0, `db:check` exit 0, `lint` exit 0, `build` exit 0. Untouched at that checkpoint: Playwright browser completion, production deployment and migrations 0007/0008, the n8n claim/lease contract, live AI/Resend/COS, payout, and admin console hardening.

Scope follows the 2026-09-05 audit and the approved participant-first order.

1. Correct review leasing, lazy judge selection, disagreement resolution, sealed results, atomic writes, and real logout.
2. Connect participant identity, enrollment history, leaderboard, points, rewards, and notifications to existing APIs.
3. Add configured AI review with verifiable artifact evidence and recoverable worker execution.
4. Complete redemption accounting, inventory reservation, admin fulfillment and reversal.
5. Complete weekly publishing, storage maintenance, operational checks, and release documentation.

Verification: focused regression tests first, then typecheck, lint, SQL contract, build, and available integration/browser tests. Live credentials, external payment execution, production migration/deployment, and cross-site login require an explicit operational handoff when unavailable locally. Career Report and Jobs remain the PRD's later phase.

Existing uncommitted UI work is preserved. No production deployment or external payment is implied by local implementation.

## Completed: Review And Result Regressions

- Judge provider is resolved only when second-judge routing requires it.
- Manual override resolves NEEDS_RESOLUTION while preserving aiScore and audit history.
- Webhook claims only its target job; unavailable leases return a retryable error.
- Retry availability follows availableAt instead of the previous lease.
- Result reads remain sealed before FINALIZED/ARCHIVED, even with partial ranking rows.
- Review persistence rechecks the lease under lock and commits review, criteria, job and audit atomically.
- Verification: 4/4 offline audit regression tests passed; typecheck passed at this checkpoint.

## Implemented, Integration Verification Pending

- Week finalization is transactional and locks the week; latest review runs determine disagreement state.
- Participant identity is server-provided; navbar logout submits POST /auth/logout.
- Historical project reads accept published/archived projects; enrollment lookup can target a project.

## In Progress

- Parallel work: live participant UI, reward accounting, project lifecycle, storage integrity.
- Main work: configured review provider, evidence verification, admin authorization, final integration.
- User instruction: update Markdown after every completed task, including verification and remaining actions.

## Completed: Provider And Evidence Contract

- Added configurable HTTPS chat-completions provider with JSON validation and request timeout.
- Provider receives blind current-version sources and rubric, without attempt history or identity.
- Evidence validation rejects unknown sources and quotes absent from extracted text.
- Production configuration cannot select the development stub.
- Verification: 3/3 provider/evidence contract tests passed (mock HTTP transport, no live AI call).
- Artifact extraction/persistence and worker integration are the next task. New artifact schema requires a migration before live use.

## Completed: End-To-End Wiring Pass (2026-09-05, uncommitted working tree)

- `voidEnrollment` is now one transaction (ledger + account + ranking delete + audit move together); skill-evidence rows for the voided enrollment are removed, so a void leaves zero residue.
- Finalization writes `skill_evidence` (one row per project skill at the final score, review-summary attached, unique review+skill, idempotent re-finalize safe). Void deletes them. Reader already serves them through surviving rankings.
- `finalizeArenaUpload` enforces magic bytes (`assertContentSignature` over downloaded bytes after the HEAD check); spoofed content is deleted and rejected. Attack suite extended with an explicit spoof case (right size, `MZ` magic as PDF).
- VPS outbound bearer is refused over plain HTTP to any custom host (legacy `202.74.75.95` box + loopback grandfathered with a loud warning). New VPS test case covers the refusal.
- `runProjectDrop` is real: Sunday window → `prepareScheduledWeek` → `generateWeek` (model via `AiGenerationProvider` when `AI_API_BASE_URL` + `AI_API_KEY` + `AI_GENERATION_MODEL` are set, library-only otherwise) → `publishWeek` only when `ARENA_AUTO_PUBLISH_ENABLED=true`. Outside the window it reports the skip honestly. Scheduler test updated.
- `AiGenerationProvider` (`src/server/generation/ai-provider.ts`): OpenAI-compatible, HTTPS-only, JSON-only, validated downstream by `validatePackage()` with library fallback — a bad model response can never publish an invalid project.
- `runStorageCleanup` (live run, limit 100) added to the scheduler + `vercel.json` (`0 3 * * *`). Manual route keeps dry-run default.
- Migration `0007_futuristic_spirit.sql` applied to the development database (`npm run db:migrate`); the "requires a migration" item above is done for dev, still pending for production.
- Double-take contract restored: same-claim repeat is refused with `VALIDATION_ERROR` (the uncommitted reward worker had turned it into an idempotent return, contradicting the tested/documented contract). `test:e2e:finalize` is green again.
- Review-prompts: `PROMPT_VERSION` is `arena-reviewer-v2-evidence`; pipeline test expectation updated (was asserting the old `v1`).
- Storage key policy: presign refuses non-UUID staging keys; `e2e-storage-live` probe updated to use a UUID key.
- Participant pages: result/workspace/submission resolve enrollment history-aware (`getMyEnrollmentForProject`: current endpoint first, `/api/arena/me` history fallback; 401 still propagates for signed-out state).
- Public project CTA no longer reads `DemoProvider`: live `getCurrentEnrollment()` decides the "Lanjutkan Project" label; anonymous behavior unchanged (401 → login modal).
- Inbox deep links use canonical project slugs (submit + finalize RESULT_READY); detail route still resolves UUIDs.
- `.env.example` documents the Hermes→Arena key handoff (`AI_API_*`), generation flags, and admin token vars. No secret is committed.

Verification this pass: `typecheck` clean, `lint` clean, `build` clean; `test:vps:automation` 7/7, `test:reviews:pipeline` 10/10, `test:finalize:ranking` 4/4, `test:phase4s:attack` 7/7, `test:e2e:upload` 4/4, `test:e2e:flow` 1/1, `test:arena:core` 9/9, `test:e2e:reviews` 1/1, `test:e2e:finalize` 1/1, `test:auth:participant` 5/5, `test:e2e:storage` 2/2 (live COS), `test:scheduler` 3/3, `test:website:transfer` 6/6, `test:db:local` 1/1. DB suites must run sequentially — parallel runs collide on the single active week. Browser suite (`test:e2e:browser`) not re-run in this pass.

## Completed: Generation Scheduler Split (2026-09-06)

- Supersedes the combined `runProjectDrop` description above. `project-generate` runs hourly Sunday 09:00-23:00 WIB and prepares/generates preview only, gated by `ARENA_GENERATION_ENABLED` before DB/provider access.
- `project-drop` runs hourly, gated by `ARENA_AUTO_PUBLISH_ENABLED`, selecting only unopened weeks whose opening time has arrived and whose deadline has not passed. It never regenerates on Monday.
- A completely held week remains eligible for retry. Per-week domain failures do not suppress later due weeks. Partial publication remains the existing policy: held projects on an already OPEN week require admin follow-up, not automatic regeneration.
- Blocked generation divisions and held publication results report `done: false` rather than a false successful drop.
- Verification: 12/12 offline generation/scheduler tests and `npm run typecheck` passed. No live inference, publication, cron deployment, or email send performed.
- External gate remains: validated library/base-rubric setup, production flags/secrets, cron-capable hosting, and deployment. Production is not marked complete.

## Completed: Durable Email Outbox (2026-09-06)

- Product transactional notices now queue EMAIL alongside the inbox; point/milestone nudges stay inbox-only. Event and delivery inserts share a transaction/savepoint, with optional durable event deduplication.
- Failed emails retry with bounded backoff, six attempts maximum. Each worker claims one delivery under `FOR UPDATE SKIP LOCKED`; lease tokens reject stale acknowledgements and expired leases are recoverable.
- Recipient, sender and rendered content are frozen on first attempt. Retries use the same provider idempotency key; uncertain deliveries older than 23 hours are held for manual reconciliation rather than risking a duplicate after Resend's 24-hour retention window.
- HTML is escaped, action links are same-origin HTTPS only, and a provider receipt is required before SENT. Missing provider configuration leaves attempts untouched; suspended users/no-email recipients are skipped.
- Migration `0008_notification_outbox.sql` generated and applied to development only. Production must apply it before deploying these readers/writers.
- Verification: 3/3 offline email tests plus 5/5 development DB outbox tests passed, including concurrent claims, crash recovery, dedupe/rollback and stale worker protection. Typecheck passed. All sends were injected fakes, not live email.
- QA finding: existing `eslint.config.mjs` contains only ignores, so TypeScript files are not linted. Do not treat historical `npm run lint` success as TypeScript lint coverage; this remains a separate QA gap.
- Provider contract reference: https://resend.com/docs/dashboard/emails/idempotency-keys . Production key/domain configuration and held-delivery admin reconciliation remain operational follow-ups.

## AI Key Handoff (Hermes VPS → Arena)

## Completed: Scheduled Product Notices (2026-09-06)

- Added `week-notifications` every 15 minutes. Open-week state drives project announcements and a deadline reminder during the final 24 hours; closed/future/expired weeks cannot broadcast.
- Announcements reach active users with prior non-voided Arena participation, even before they enroll in the new week. Reminders target only ACTIVE enrollments in the selected week, excluding submitted and suspended users.
- Each batch is capped at 100 eligible users. Durable per-type/week/user keys prevent duplicates across cron retries and concurrent calls; later ticks drain remaining users and retry failed writes. These operations queue emails; they do not call the email provider.
- Verification: 6/6 development DB notification tests plus 1/1 offline schedule-boundary test passed; typecheck passed. Broadcast fixtures rolled back, and email tests used fake transport only.
- Production scheduler deployment and real sender verification are still pending. No live participant broadcast performed.

## Completed: Development Review Evidence Regression (2026-09-06)

- Fresh finalization regression exposed a development-stub defect when real artifact extraction is configured: a short explanation was chosen ahead of an adequate artifact and failed the minimum quote length.
- Stub now selects an actual source with at least 12 trimmed characters, or fails if none exists. Production evidence validation was not weakened.
- Verification: new test failed before the change; all 4 provider/evidence tests passed after it. Full finalization rerun is tracked below, not assumed from this unit pass.

## AI Key Handoff Details

- Live key lives on the Hermes VPS (`202.74.75.95`, n8n box). Copy from there into Vercel env (production) / `.env` (local): `AI_API_BASE_URL`, `AI_API_KEY`, `AI_REVIEW_MODEL`, `AI_VALIDATOR_MODEL`, `AI_JUDGE_MODEL`, `AI_GENERATION_MODEL`, plus `AI_REVIEW_PROVIDER=openai-compatible`.
- Two grading paths, two key homes: (A) Hermes grading keeps the model key on the VPS inside n8n — Arena needs only `ARENA_EVAL_TOKEN` to accept `/api/webhooks/arena-eval`; (B) Arena internal worker (`POST /api/internal/reviews/run`) and the Monday generator need the copied `AI_API_*` vars. Without them the worker fails closed and generation runs library-only.
- Still external: Vercel project + DNS, production DB + migration 0007 + backup, `SESSION_SECRET`/`COOKIE_DOMAIN` parity, voucher contract, Resend live, n8n repoint/reactivation, worker deployment + monitoring.

## Production Provisioning Status (2026-09-06)

Infrastructure is provisioned but **nothing is deployed yet**, and the production
database is still empty. The order that matters: migrate, then deploy. Deploying
first gives a running app whose every page 500s against a schemaless database.

Done and verified:

- **Neon**: project `side-hustle-arena-dev`, branch `production` (Singapore,
  Postgres 18.6). Reachable; zero application schemas. The `production` branch is
  a sibling of `development` in one Free-tier project — shared quota, and history
  retention is 6 hours, which is the real backup window to fix before launch.
- **Vercel**: project `side-hustle-arena` (`prj_xkRTKdJIJqfBF6mGa1pWbbXXJaue`,
  team `team_zG6ZTo31uaXX51QCVfCAcqTH`), framework auto-detected as Next.js,
  linked to the GitHub repo. 37 production environment variables set — 23 by the
  owner (SESSION_SECRET, the six AI_*, Resend, VPS webhook, storage bucket and
  endpoint, SSO client, main-site voucher) and 14 in this session (APP_ENV,
  origins, cookie domain, DATABASE_URL, the four internal tokens, storage keys,
  admin scopes). Timestamps confirm no variable was overwritten.
- **Tencent COS**: `sidehustlearena-prod-1468190043` (ap-jakarta, APPID
  1468190043). Private — the owner holds the only grant, no public ACL. CORS
  already allows `PUT/HEAD/GET` from both `https://arena.sekolahkarir.id` and
  `https://side-hustle-arena.vercel.app`, exposing `ETag` and
  `Content-Disposition`. That second origin matters: it is how uploads can be
  exercised before DNS resolves.
- **Resend**: `sekolahkarir.id` verified a month ago (shared with the main site),
  so `arena@sekolahkarir.id` sends without new DNS.

Blocked or outstanding:

- **Migrations have not run against production.** `scripts/db-migrate.mjs`
  refuses any APP_ENV other than development/test, by design. Rather than weaken
  that guard, `scripts/prod-migrate.tmp.mjs` is an explicit production path that
  demands `--i-mean-production` and its own `PROD_DATABASE_URL`. It could not be
  executed from this session — the harness blocks writes to a production
  database — so the owner runs it. It only ever creates schema.
- **No deployment exists yet.** Trigger only after migrations succeed.
- **`arena.sekolahkarir.id` is unverified.** DNS is at NeoDNS
  (`satu.neodns.id` / `dua.neodns.id`) and needs a TXT verification record plus a
  CNAME for the `arena` host. `side-hustle-arena.vercel.app` already resolves and
  is the sane first smoke-test target.
- **`ARENA_ADMIN_SUBJECTS` is unset**, so the new admin console admits nobody.
  It cannot be filled until each intended admin has signed in once and their
  `identity.users.auth_subject` exists to copy.
- **`ARENA_EVAL_TOKEN` was generated fresh in this session.** The Hermes/n8n side
  has never held this value. Grading callbacks will authenticate only once n8n is
  configured with it — a coordination step, not a regression, since the variable
  did not exist before.

Also landed this session: the admin console UI (`/app/admin` — overview, feature
flags, weeks, reviews, participants, rewards), wired entirely to the existing
tested admin APIs. No new backend was needed; the gap really was only the pages.
Typecheck, lint and build are clean. Its browser pass is still outstanding.

## Completed 2026-09-06: CV Scanner Backend, Hidden Behind A Flag

The CV Scanner was a front end with nothing behind it: no API route existed, and
every component read `@/data/mock/cv`, so any CV produced the same score, the
same strengths and the same skill gaps. It is now a real analysis, and it is
switched off until it has been exercised against real CVs.

**One flag, four surfaces.** `NEXT_PUBLIC_CV_SCANNER_ENABLED` gates the
navigation entries (public navbar, app navbar, footer, mobile bottom nav), the
landing-page CTAs, the three view components, and `POST /api/cv-scan`. Anything
less would allow a half-launch: a visible link with a dead endpoint, or a live
endpoint nobody audited. While it is off the landing CTA points at the Arena and
the scanner routes explain that the feature is not open yet.

**What the analysis does.** `src/server/cv/analyzer.ts` reuses the Arena
reviewer's provider settings (`AI_API_BASE_URL`, `AI_API_KEY`, and
`AI_CV_MODEL` falling back to `AI_REVIEW_MODEL`) but not its contract — the
reviewer scores a submission against a project rubric, this reads one document
and reports on the CV. A Zod schema validates every reply before it reaches a
page; the four metric labels and the weak-metric threshold are applied
server-side so the model cannot rename or re-rank them. The prompt states that
the document is untrusted data and that nothing may be invented.

**The CV is never stored.** Bytes arrive in the request, `extractDocumentText`
(shared with the Arena reviewer) turns them into text, the text goes to the
model, and everything is dropped when the response returns. There is no object
in storage and no row in the database, so there is no copy of anyone's CV to
leak — and no migration was needed.

**Result shape.** `CvResult` in `src/types/cv.ts` grew `qualityChecks`,
`atsChecks` and `impactExamples`, because the result page has tabs for them.
Leaving those on mock data beside a real score would have been worse than the
old all-mock page: real numbers lending credibility to invented findings. Two
hard-coded strings were removed from `CvResultView` at the same time — the third
"improvement" was pinned to sample text regardless of the analysis, and the
Impact tab asserted "Impact belum menggunakan angka" as fixed copy.

**Carrying the file between routes.** Upload and analysis are separate routes
and a `File` cannot travel through the demo store, so `startCvScan` posts from
the upload page and parks the in-flight promise at module scope for the
analyzing route to await. A reload loses it, which is exactly when the analyzing
page should send the visitor back to pick the file again. The progress ring now
stops at 92% until the response lands, instead of animating to 100% on a timer.

**Rate limiting is deliberately weak and labelled as such.** The endpoint is
unauthenticated and spends money per call, so `src/server/cv/rate-limit.ts`
allows five scans per hour per forwarded IP. The counter lives in one serverless
instance's memory: it resets on cold start and does not coordinate across
instances. It stops a casual loop, not a determined one. Real protection needs
shared state (the Arena database or a KV store) and is still outstanding.

Verification: `npm run test:cv:scan` 7/7 (mapping, schema rejection of
out-of-range scores and unknown evidence levels, no paid call for an unusable
document, empty-rewrite case, limiter burst/refusal/expiry, forwarded-IP
parsing); `typecheck` exit 0; `lint` exit 0 with 15 warnings, unchanged from
before this work; `build` exit 0 with `/api/cv-scan` registered. The webpack
"critical dependency" warnings on that route come from `officeparser`'s dynamic
module loading and already existed on the Arena reviewer path that shares it.

Not done: no real CV has been through this yet — the flag stays off until one
has. The public Arena landing page also stopped throwing when no week exists
(`getPublicArenaHome` returns null for `WEEK_NOT_FOUND` only, so a database
outage still surfaces as an error), which is what made `/arena` return 500 on the
first production deployment.
