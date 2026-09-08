# Side Hustle Arena — Sekolah Karir career product

A weekly project competition with an AI reviewer, plus the career surfaces around
it. This is a full application: PostgreSQL, real authentication, real model
calls, scheduled jobs, object storage, and an admin console.

> The previous version of this file described a frontend-only prototype on
> Next.js 15 with mocked data and no backend. That has not been true for some
> time; the 7 September 2026 audit flagged it as the single most misleading
> document in the repository. If you find another claim here that the code
> contradicts, the code wins — please fix the file.

## What it does

- **Public Arena** (`/arena/*`) — the weekly program, project browsing, and the
  showcase of finalized winners.
- **Participant app** (`/app/*`) — enrollment, the submission workspace (files
  and links, immutable versions, deadline and attempt limits), results, points,
  the career report, and rewards.
- **AI review pipeline** — document extraction (PDF/DOCX, OCR fallback), a blind
  reviewer with evidence validation, a second judge on disagreement or low
  confidence, a retrying job queue, and server-side weighted scoring. Scores are
  computed inside the Arena; no worker or webhook ever supplies one.
- **Project generator** — generates and validates the week's projects against a
  frozen per-division rubric, with anti-duplication, a library fallback, and an
  approval/publish step.
- **Admin console** (`/app/admin`) — weeks, projects, divisions, users, reviews,
  rewards, email outbox, jobs, feature flags, and an append-only audit log.
- **CV Scanner** (`/cv-scanner`) — behind `NEXT_PUBLIC_CV_SCANNER_ENABLED`.

## Stack

- Next.js 16.3.3 (App Router) + React 19.2 + TypeScript
- PostgreSQL (Neon) via Drizzle ORM; migrations in `drizzle/`
- Tailwind CSS v4, Manrope, Lucide icons
- S3-compatible private object storage (Tencent COS in production, MinIO locally)
- OpenAI-compatible model providers, selected per profile (review / judge /
  generation / CV)

## Run it

```bash
npm install
cp .env.example .env      # then fill it in — see "Configuration"
npm run db:migrate        # refuses any APP_ENV but development/test
npm run dev -- -p 3001
```

Open <http://localhost:3001>.

**Use port 3001, not 3000.** `ARENA_ORIGIN` and `ARENA_ALLOWED_ORIGINS` name the
Arena's own origin, and every state-changing request is origin-checked against
them. Port 3000 belongs to the main Sekolah Karir site, which is a separate
codebase. Running the Arena on 3000 makes every POST fail the origin check.

### Signing in locally

The Arena has no login of its own. It verifies `sk_participant`, an HS256 cookie
issued by the main Sekolah Karir site and signed with the shared
`SESSION_SECRET` — issuing, refreshing and revoking all stay there. That site
does not run on most developer machines, so there are two local paths:

- **Sandbox** — `node scripts/local-dev.mjs` (needs Docker) boots against a local
  `arena_local` database with a private MinIO bucket, and `/dev` offers fixture
  participant and admin logins. Nothing external is called.
- **Against your own database** — `node scripts/qa-session.tmp.mjs setup` mints a
  cookie for a fixture participant and prints the one-liner to paste into the
  browser console.

Admin access is an allowlist of exact `identity.users.auth_subject` values in
`ARENA_ADMIN_SUBJECTS` (`sk-participant:<id>` — never an email). See
`docs/backend/ADMIN_OPERATIONS.md`.

## Configuration

`.env.example` is the complete list with comments. The ones nothing works
without: `DATABASE_URL`, `APP_ENV`, `SESSION_SECRET`, `ARENA_ORIGIN`,
`ARENA_ALLOWED_ORIGINS`, `SK_AUTH_ORIGIN`, and the `STORAGE_*` set.

`SESSION_SECRET` **must** be byte-identical to the main site's in production. If
it differs, every visitor reads as logged out.

## Scripts

```bash
npm run dev            # dev server (pass -- -p 3001)
npm run build          # production build
npm run start          # production server
npm run lint           # ESLint
npm run typecheck      # tsc --noEmit
npm run db:migrate     # apply migrations (development/test only)
npm run db:check       # schema definitions vs migrations
npm run db:generate    # generate a migration from schema changes
npm run test:offline   # every suite that needs no database or paid provider
```

`npm run test:offline` is what CI runs. It prints each suite it skips and why —
suites needing a live database, and a short list of known exclusions. The
database-backed suites (`test:e2e:*`, `test:arena:*`, `test:scheduler`, …) are
listed in `package.json` and need a real `DATABASE_URL`.

### The isolated local sandbox

Loopback Postgres and MinIO, no shared environment and no credentials of any
kind. This is the routine local check:

```bash
node scripts/local-dev.mjs --setup-only   # start containers, migrate, seed
npm run test:local:all                    # lifecycle + jobs + privacy/limits
npm run test:browser:local                # Playwright against the sandbox
npm run db:seed:jobs:fixture              # a jobs provider that needs no vendor
```

`npm run test:local:lifecycle` drives enrol → workspace → real presigned upload
→ submit → review → finalize → points, and replays the upload URL with
equal-size different bytes to prove the reviewed artifact cannot be swapped.
It replaces the old `scripts/true-e2e-test.mjs`, which claimed more than it
tested.

`playwright.config.ts` (`test:e2e:browser`) is the *other* browser suite: it
drives the shared cloud development database and the live bucket, so it needs
that environment. `playwright.sandbox.config.ts` (`test:browser:local`) needs
nothing but Docker.

## Layout

```
src/app/         routes: (public), (app), api, auth, dev
src/server/      the backend — arena, reviews, generation, rewards,
                 notifications, finalization, submissions, storage, admin,
                 auth, scheduler, db (schema + migrations source)
src/features/    feature-level UI
src/components/  shared UI
drizzle/         generated SQL migrations
scripts/         test suites, migration and seed tooling, local sandbox
n8n/             scheduler and ad-hoc launch workflows
e2e/             Playwright against the shared dev environment
e2e-local/       Playwright against the isolated sandbox
docs/backend/    contracts, audits, operations
```

## Scheduling

Jobs live at `GET /api/cron/<job>` behind a bearer token. n8n is the real
scheduler — Vercel's Hobby plan cannot fire below daily granularity, and the
review drain needs a couple of minutes. n8n only says *when*; the Arena decides
and does everything else.

Three cadences are load-bearing rather than cosmetic, and are asserted by
`scripts/automation-contract.test.mjs`: `email-flush` every 15 minutes (a failed
message may only be retried inside the provider's 23h idempotency window),
`project-generate` hourly through the Sunday window (six divisions do not fit in
one 60s invocation), and `jobs-sync` every four hours. Every timeout in the
pipeline comes from one place — `src/server/ops/execution-budget.ts`.

See `docs/backend/N8N_SEKOLAH_KARIR_MIGRATION.md` for the current shape;
`docs/backend/N8N_TRIGGER_ONLY.md` still describes the *rule* correctly but its
job list and cadences are out of date.

## Where to read next

- `docs/backend/REMEDIATION_2026-09-08.md` — the most recent record of what
  changed and what is still open. Start here.
- `docs/backend/IMPLEMENTATION_AUDIT_2026-09-08.md` — the audit it answers.
- `docs/backend/JOBS_PIPELINE.md` — connecting a real jobs provider, and running
  the pipeline.
- `docs/backend/SHOWCASE_CONSENT.md` — consent, account deletion, retention.
- `docs/backend/ADMIN_OPERATIONS.md` — admin authorization and the console.
- `docs/backend/N8N_TRIGGER_ONLY.md` — the scheduler contract.
- `AGENTS.md` — this Next.js version differs from what most tools assume; read
  the bundled docs before writing framework code.
