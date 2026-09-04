# Session Handoff - 2026-09-04

## Goal

Finish Side Hustle Arena against the master PRD using Vercel, Neon PostgreSQL,
and a private Tencent COS bucket. Reuse relevant Sekolah Karir code without
modifying the source repositories, then replace mock frontend state with the
authoritative backend while preserving the approved visual design.

## Decisions That Must Stay Stable

- Vercel hosts the application.
- Neon owns text, metadata, workflow state, review state, points, and rewards.
- Tencent COS stores private file bytes through the S3-compatible API.
- Weekly cutoff is Friday 23:59 WIB.
- A participant can join one project per week and gets at most three valid AI
  review attempts; technical failures do not consume an attempt.
- Final points are rank-based: 300, 200, 150, and 100.
- Only `usd-20-cash` is active: 2,000 points for USD 20. Legacy reward SKUs are
  inactive because the PRD does not define their prices.
- VPS scope is the full port: n8n hooks, evaluation ingest, milestones, voucher
  integration boundary, and queued email delivery.
- Do not invent public metrics. Hide values for which no authoritative backend
  source exists.
- Keep the current visual language. Frontend wiring should change data sources,
  not redesign pages.
- Production has not been touched.

## Completed Work

- Generalized storage from R2-only to Tencent COS/S3-compatible configuration.
  Regional endpoint handling and the double-bucket TLS bug were fixed.
- Ported reusable website utilities: feature flags, avatars, username guard,
  formatter helpers, and reward catalog.
- Applied development Neon migrations through `0006`:
  - `0003_careless_invisible_woman.sql`: `ops.feature_flags`.
  - `0004_melted_golden_guardian.sql`: review rerun and `NEEDS_RESOLUTION`.
  - `0005_happy_silver_fox.sql`: notification read state and index.
  - `0006_luxuriant_charles_xavier.sql`: `MILESTONE_REACHED`.
- Implemented the AI review pipeline: leased queue, retry handling, blind input,
  validator, deterministic backend scorer, second judge, rerun, override, audit,
  development stub worker, and internal routes.
- Implemented finalization: deterministic ranking, idempotent point ledger,
  fraud void, and reversal support.
- Implemented notifications and admin backend services: inbox, unread/read,
  submit/finalize notifications, broadcast, ops overview, and audited feature
  flags.
- Implemented VPS automation boundaries: outbound n8n hooks,
  `/api/webhooks/arena-eval`, dedupe, milestone ladder/take, Resend queue, and
  voucher push interface.
- Wired public Arena reads to live Neon data through
  `src/lib/arena-view.ts`:
  - `/arena`: current projects, active divisions, live deadline, week label.
  - `/arena/projects`: live browse, search, filters, and counts.
  - `/arena/projects/[slug]`: live detail, requirements, rubric, skills, and
    deadline.
- Removed mock-only public points and participant counters rather than faking
  them.
- Components accept live props while retaining mock defaults so existing
  authenticated demo screens are not broken yet.
- Added the detailed public-wiring contract at
  `docs/backend/FRONTEND_WIRING_9A.md` and updated
  `docs/backend/IMPLEMENTATION_STATUS.md` to Phase 9a complete.

## Verification Evidence

The following were green during this work:

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run db:check`
- `npm run test:website:transfer` (6/6)
- `npm run test:reviews:pipeline` (10/10)
- `npm run test:vps:automation` (6/6)
- `npm run test:finalize:ranking` (4/4)
- `npm run test:e2e:flow`
- `npm run test:e2e:reviews`
- `npm run test:e2e:finalize`

The production build was also exercised over HTTP with live development seed
data for the three public Arena routes.

## Known Issues And Blockers

- `npm run test:e2e:storage` fails on direct PUT with HTTP 403. Fix Tencent CAM
  credentials/bucket policy using `docs/backend/TENCENT_COS_SETUP.md`.
- Tencent credentials appeared in prior terminal output. Rotate the secret key
  before using the bucket again. Never copy credentials into documentation.
- Unknown project slugs render the correct branded 404 UI and `noindex`, but
  the streamed Next.js response currently has HTTP status 200. Track this as
  production SEO/status-code hardening; the attempted metadata change did not
  fix it and was reverted.
- The real AI provider/Hermes integration is not provisioned; development uses
  `stub-dev-v1`.
- VPS n8n workflows have not been repointed and production Resend/VPS tokens are
  not provisioned.
- The main-site voucher contract is undecided, so `pushRewardCode()` reports
  `pushable: false`.
- Reward fulfillment still lacks inventory locking and balance deduction/hold.
- Browser admin UI and its authorization model are not implemented.
- Root still mounts `DemoProvider`; `CtaActions` and authenticated `/app/*`
  Arena screens still use mock/localStorage state.
- Production website auth uses OTP/shared-cookie behavior while this repository
  has a PKCE/opaque-session bridge. Do not blindly port auth; decide the identity
  contract before wiring authenticated screens.
- Review external-ingest claiming should be audited before production: claiming
  a generic next pending job may lease the wrong job when the webhook targets a
  different job and multiple jobs are queued.
- The working tree contains a large, intentional, uncommitted change set. Do not
  reset or overwrite unrelated work. No commit was created in this session.

## Next Tasks

1. Start Phase 9b by mapping every `DemoProvider` read/action used under the
   authenticated Arena routes.
2. Decide the browser identity/session contract before replacing authenticated
   mock state.
3. Add a typed service/API client for enrollment, workspace, submission,
   results, notifications, milestones, and leaderboard.
4. Replace mock state one vertical flow at a time while preserving routes and
   visuals: enroll -> workspace -> submit -> review result -> leaderboard.
5. Add authenticated E2E coverage for that flow.
6. Before any upload demo, rotate Tencent credentials, fix CAM/bucket policy,
   and rerun `npm run test:e2e:storage`.

## High-Signal Files

- `docs/superpowers/plans/side-hustle-arena-master-prd.md`
- `docs/backend/IMPLEMENTATION_STATUS.md`
- `docs/backend/FRONTEND_WIRING_9A.md`
- `src/lib/arena-view.ts`
- `src/app/(public)/arena/page.tsx`
- `src/app/(public)/arena/projects/page.tsx`
- `src/app/(public)/arena/projects/[slug]/page.tsx`
- `src/features/demo/store.tsx`
- `src/server/reviews/`
- `src/server/finalization/`
- `src/server/notifications/`
- `src/server/rewards/`
- `src/server/automation/vps-hooks.ts`
- `docs/backend/TENCENT_COS_SETUP.md`
- `docs/backend/VPS_AUTOMATION.md`
