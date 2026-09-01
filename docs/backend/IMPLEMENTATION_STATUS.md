# Side Hustle Arena - Backend Implementation Status

## Current Phase

PHASE 1 - Database Foundation

## Status

COMPLETE - LOCAL FOUNDATION ONLY

## Phase 0 - Repository/Auth/Backend Readiness Audit

Status: COMPLETE

The audit established that the approved Next.js frontend was mock-driven, had no server API/auth/database boundary, and required a protected checkpoint before backend work.

## Phase 0.5 - Frontend Baseline Checkpoint

Status: COMPLETE

- Checkpoint commit `36bd42f` was created on `feature/arena-backend-foundation`.
- The approved frontend remains canonical and unchanged.
- Auth remains `MOCK ONLY`.
- Backend work began only after this checkpoint.

## Phase 1 - Database Foundation

Status: COMPLETE - migration generated locally and not applied.

- Dependencies added: `drizzle-orm`, `drizzle-kit`, `postgres`, and `zod`.
- Logical schemas implemented: `identity`, `arena`, `rewards`, `notifications`, `automation`, and `audit`.
- 30 tables, PostgreSQL enums, foreign keys, targeted indexes, and checked/unique constraints are declared under `src/server/db/schema/`.
- Lazy `getDb()` reads `DATABASE_URL` only when used; frontend builds do not require it.
- Migration generated: `drizzle/0000_previous_thing.sql`.
- Migrations applied: NO.
- Real database connected: NO.
- Frontend changed: NO.
- Auth bridge implemented: NO.
- No seed system, R2, Redis, review worker, scheduler, VPS access, or deployment was added.

Next phase recommendation: PHASE 2 - SEKOLAH KARIR AUTH BRIDGE + SERVER AUTHORIZATION FOUNDATION.

## Production Hostname

arena.sekolahkarir.id

## Current Frontend Status

Approved Next.js App Router frontend baseline. The UI remains driven by `src/features/demo/store.tsx`, `src/data/mock/*`, and `src/features/demo/report.ts`; no frontend source changed during Phase 1.

## Current Backend Status

No API routes, route handlers, server actions, server services, middleware, proxy, API client, or frontend/backend integration are present. The database client is a server-side foundation only.

## Current Database Status

Drizzle schema, migration configuration, an offline generated migration, and a lazy postgres.js client boundary are present. PostgreSQL/Neon is a target only: no database was connected and no migration was applied.

## Current Auth Status

Mock only. The future auth bridge will map the canonical Sekolah Karir immutable subject to `identity.users.auth_subject`; no cookie/session/JWT/OAuth code or Arena credentials were added.

## Repository Integrity Status

The approved frontend checkpoint is `36bd42f` on `feature/arena-backend-foundation`. The allowed pre-existing untracked paths remain `.gitattributes`, `docs/UI mockups request/`, and `graphify-out/`; they are excluded from backend work.

## Final Business Rules

- One project maximum per user per week.
- Projects drop Monday; the weekly deadline is Friday 23:59 Asia/Jakarta.
- No late selection, submission, or resubmission.
- Draft editing is unlimited and does not consume a review attempt.
- Maximum 3 valid AI-reviewed submission attempts per project/week.
- Technical access failure does not consume a valid review attempt.
- Review remains hidden until finalization.
- Leaderboard is global: score DESC, then final submit time ASC.
- Rank points are 300, 200, 150, then 100; points never expire.
- A 2,000-point USD 20 reward is a limited SKU, not a conversion rate.
- Existing Sekolah Karir identity must be reused.

## Legacy Mock Behaviors That Must Not Become Backend Rules

- Any-credential login and localStorage authority.
- Client-only URL validation and one mutable URL-only submission.
- Browser review timers, immediate results, client-generated review data, and client point mutation.
- Static week/deadline data, a featured `+120` display, seeded balances, and mock job data.

## Phase 1 Outcome

- `auth_subject` is a neutral immutable external-identity bridge; it is not email and does not create Arena credentials.
- One enrollment per user/week, immutable submission versioning, review/ranking uniqueness, and idempotent financial/automation rows are database-enforced.
- Generated SQL was reviewed for six schemas, enums, UUID defaults, `timestamptz`, foreign keys, indexes, checks, and restrictive history preservation.

## Known Unknowns

Canonical auth/session and subdomain-cookie behavior; external roles; database ownership; storage provider; access-check/review queue; automation authentication; reward fulfillment; notification delivery; and deployment topology.

## Recommended Next Phase

PHASE 2 - SEKOLAH KARIR AUTH BRIDGE + SERVER AUTHORIZATION FOUNDATION

Confirm the canonical subject, session/cookie behavior, roles, subdomain policy, and server authorization before wiring any route or replacing mock state. Do not apply the migration to a real database until a separate deployment/migration phase is approved.
