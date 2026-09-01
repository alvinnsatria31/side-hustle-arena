# Side Hustle Arena — Backend Implementation Status

## Current Phase

PHASE 0 — Repository/Auth/Backend Readiness Audit

## Status

COMPLETE

## Phase 0.5 — Frontend Baseline Checkpoint

Status: READY

- A clean local baseline checkpoint will be created on the backend foundation branch.
- The current approved frontend is canonical and remains unchanged.
- Backend may start after the checkpoint commit.
- Auth remains `MOCK ONLY`.
- Database remains `NOT IMPLEMENTED`.

## Production Hostname

arena.sekolahkarir.id

## Current Frontend Status

Approved Next.js App Router frontend prototype verified. Next.js 16.3.3, React 19.2.0, TypeScript 5.7.3 strict, Tailwind CSS 4.1.18, Motion 13.1.1, and lucide-react 0.469.0 are present. `npm run lint`, `npm run typecheck`, `npm run build`, and `git diff --check` passed. The build generated 48 routes.

The UI is driven by `src/features/demo/store.tsx`, `src/data/mock/*`, and `src/features/demo/report.ts`. No frontend source was changed during this audit.

## Current Backend Status

No API routes, route handlers, server actions, server services, middleware, proxy, API client, or backend integration are present.

## Current Database Status

No database code, ORM, migrations, schema, Postgres/Neon driver, Supabase integration, or database dependency is present. No database was connected.

## Current Auth Status

Mock only. `/login` accepts any credentials and writes a demo user into client React/localStorage state. `/app` routes have no server authentication or identity verification. No auth library, cookie/session code, JWT, OAuth callback, canonical user ID, or Arena subdomain auth integration was found.

## Repository Integrity Status

`DANGEROUS/AMBIGUOUS`. On branch `main`, the working tree has 27 tracked modified paths, 67 tracked deleted paths, and 44 untracked porcelain entries. The state matches the reported uncommitted frontend rebuild shape, but it remains uncommitted and must not be reset or discarded. Only the three Phase 0 documents in this directory were created by this audit.

## Final Business Rules

- One project maximum per user per week.
- Projects drop Monday; the weekly deadline is Friday 23:59 Asia/Jakarta.
- No late selection, submission, or resubmission.
- Draft editing is unlimited and does not consume a review attempt.
- Maximum 3 valid AI-reviewed submission attempts per project/week.
- Technical access failure does not consume a valid review attempt.
- Review is asynchronous.
- Review remains hidden until finalization.
- Finalization happens after the week closes and required final reviews finish.
- Leaderboard is global across divisions.
- Ordering is score DESC, then final submit time ASC.
- #1 receives 300 points.
- #2 receives 200 points.
- #3 receives 150 points.
- #4+ receives 100 points.
- Points never expire.
- 2,000 Arena Points → USD 20 limited reward.
- There is no fixed point/USD conversion.
- VPS has no direct database access.
- Existing Sekolah Karir identity must be reused.

## Legacy Mock Behaviors That Must Not Become Backend Rules

- Any-credential login and client/localStorage session.
- `/app` access without server auth.
- One mutable submission with one URL.
- Client-only URL validation presented as link validation.
- 6-second/20-second browser review timer.
- Immediate result visibility after mock review.
- Opening the result page marks completion.
- Client-generated deterministic score/rubric/feedback.
- Client-side point mutation from `project.points`.
- Featured `+120 points` display; no fixed +120 rule exists.
- Static week 36 data and the current Friday 21:59 label.
- Showcase/weekly history presented as if it were a global leaderboard.
- Seeded 320 points, static career report progress, and mock jobs.

## Critical Constraints for Future Agents

- Preserve the approved frontend visuals, routes, components, and interaction patterns.
- Do not reset or discard the current dirty rebuild.
- Treat the backend as the source of truth for identity, week locks, enrollment, submissions, reviews, scores, ranks, points, and rewards.
- Enforce ownership and week scope on every user resource.
- Keep immutable submission versions and separate access failure from valid review attempts.
- Never expose review results before finalization.
- Do not connect to production databases, access the VPS, deploy, install dependencies, or modify external automation without explicit scope.
- Never print secrets or environment values.

## Phase 1 Preconditions

- Review and preserve the uncommitted rebuild boundary.
- Obtain the canonical Sekolah Karir auth contract and immutable user ID.
- Confirm week IDs, publication lifecycle, Asia/Jakarta deadline enforcement, and admin/automation ownership.
- Select the local-safe Postgres/Neon and Drizzle migration approach.
- Define the first API/service seam replacing `DemoProvider` without UI redesign.

## Known Unknowns

Canonical auth/session and subdomain-cookie behavior; external user ID and roles; database ownership; storage provider; access-check/review queue; automation authentication/idempotency; job portal API/handoff; final state names; rubric normalization; project approval/publishing; reward inventory/fulfillment; notification delivery; and production deployment topology.

## Recommended Next Phase

PHASE 1 — Database Foundation

Keep scope to Drizzle configuration, local-safe database connection abstraction, migration workflow, and the initial PostgreSQL model/constraints for users, weeks, projects, and enrollments. Do not redesign the frontend or implement production auth, uploads, review workers, rewards, automation, VPS access, or remote migrations in that phase unless separately approved.

## Files Next Agent Should Read First

1. `docs/backend/BACKEND_AUDIT.md`
2. `docs/backend/FRONTEND_BACKEND_CONTRACT.md`
3. `src/features/demo/store.tsx`
4. `src/types/project.ts`
5. `src/data/mock/projects.ts`
6. `src/data/mock/arena.ts`
7. `src/app/(app)/layout.tsx`
8. `src/app/(app)/app/arena/workspace/[projectId]/page.tsx`
9. `src/app/(app)/app/arena/submission/[projectId]/page.tsx`
10. `src/app/(app)/app/arena/result/[projectId]/page.tsx`
11. `src/app/(public)/login/page.tsx`
12. `package.json`
