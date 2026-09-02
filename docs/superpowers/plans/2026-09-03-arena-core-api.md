# Arena Core Week and Project APIs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the server-authoritative current-week, visible-project, enrollment, and workspace APIs required for Arena Phase 3.

**Architecture:** Route handlers under `src/app/api/arena` authenticate and validate inputs, then delegate business rules to focused `src/server/arena` services. The existing Drizzle schema remains authoritative: `arena.weeks`, `week_rules`, `projects`, `enrollments`, and `workspace_progress`; no migration, frontend replacement, or lifecycle automation is part of this phase.

**Tech Stack:** Next.js 16 App Router route handlers, TypeScript, Drizzle ORM/PostgreSQL, Zod 4, Node test runner, existing development database.

---

### Task 1: Define the server contract and verify it fails before implementation

**Files:**
- Create: `src/server/arena/errors.ts`
- Create: `src/server/arena/schemas.ts`
- Create: `scripts/arena-core-api.test.mjs`
- Create: `scripts/arena-core-live.test.mjs`

- [ ] **Step 1: Write failing service and route-contract tests**

Cover current-week selection, public visibility, cross-division selection, exact-deadline locking, duplicate/conflicting/concurrent enrollment, ownership/IDOR, and bounded workspace validation. The tests import real server modules or call the development server and create uniquely named fixtures that are deleted in `finally`.

- [ ] **Step 2: Run the new tests to verify RED**

Run: `node --test scripts/arena-core-api.test.mjs`

Expected: FAIL because `src/server/arena` services and the API routes do not exist.

- [ ] **Step 3: Add the shared contract types**

Define normalized `ArenaDomainError` codes, an error-to-HTTP-status helper, a controllable `Clock` type, and Zod schemas for UUID project selection plus bounded workspace fields (`currentStep`, text fields, and JSON arrays/objects).

- [ ] **Step 4: Run the unit contract tests to verify GREEN**

Run: `node --test scripts/arena-core-api.test.mjs`

Expected: PASS for input validation and normalized domain errors.

### Task 2: Implement current-week and visible-project read services

**Files:**
- Create: `src/server/arena/week-service.ts`
- Create: `src/server/arena/project-service.ts`
- Create: `src/server/arena/index.ts`
- Create: `src/app/api/arena/week/current/route.ts`
- Create: `src/app/api/arena/divisions/route.ts`
- Create: `src/app/api/arena/projects/route.ts`
- Create: `src/app/api/arena/projects/[slug]/route.ts`
- Modify: `scripts/arena-core-api.test.mjs`

- [ ] **Step 1: Write failing read-path assertions**

Assert deterministic selection priority (`OPEN`, then next `SCHEDULED`, then the most recently ended user-facing status), persisted status preservation, current-week-only published project visibility, inactive-division exclusion, safe division filtering, project detail joins, and `Cache-Control: no-store`.

- [ ] **Step 2: Run the focused assertions to verify RED**

Run: `node --test scripts/arena-core-api.test.mjs --test-name-pattern="week|project|division"`

Expected: FAIL because the read services/routes are absent.

- [ ] **Step 3: Implement the minimal read services and handlers**

Use one centralized `now` value in the services. Read paths only return `PUBLISHED` projects belonging to the resolved current week and active divisions; project detail includes skills, rubric, and submission requirements. Export `dynamic = "force-dynamic"` and send `Cache-Control: no-store` from every handler.

- [ ] **Step 4: Re-run focused assertions**

Run: `node --test scripts/arena-core-api.test.mjs --test-name-pattern="week|project|division"`

Expected: PASS.

### Task 3: Implement enrollment and workspace mutation services and routes

**Files:**
- Create: `src/server/arena/enrollment-service.ts`
- Create: `src/server/arena/workspace-service.ts`
- Create: `src/app/api/arena/enrollments/route.ts`
- Create: `src/app/api/arena/enrollments/current/route.ts`
- Create: `src/app/api/arena/enrollments/[id]/route.ts`
- Create: `src/app/api/arena/enrollments/[id]/workspace/route.ts`
- Modify: `scripts/arena-core-api.test.mjs`
- Modify: `scripts/arena-core-live.test.mjs`

- [ ] **Step 1: Write failing mutation assertions**

Assert authentication and same-origin requirements, UUID/body validation, active/open/deadline/published/project-week/rule checks, idempotent same-project retry, conflict-safe different-project retry, two concurrent requests producing exactly one enrollment, no selection switching, ownership predicates, workspace upsert, and deadline-locked workspace writes.

- [ ] **Step 2: Run the mutation tests to verify RED**

Run: `node --test scripts/arena-core-api.test.mjs scripts/arena-core-live.test.mjs`

Expected: FAIL because enrollment and workspace services/routes are absent.

- [ ] **Step 3: Implement the minimal mutation path**

Use a transaction for each enrollment attempt. Re-read the week, rules, and project inside the transaction, insert the enrollment, and map PostgreSQL unique violation `23505` to an existing same-project result or an `ALREADY_ENROLLED_THIS_WEEK` conflict without exposing another user. Query every enrollment/workspace resource with both `enrollment.id` and the authenticated `user.id` predicate; create workspace progress lazily with an upsert.

- [ ] **Step 4: Re-run mutation tests**

Run: `node --test scripts/arena-core-api.test.mjs scripts/arena-core-live.test.mjs`

Expected: PASS, with live fixtures removed even on assertion failure.

### Task 4: Seed development data, document behavior, and verify the checkpoint

**Files:**
- Create: `scripts/seed-arena-core.mjs`
- Modify: `package.json`
- Modify: `docs/backend/IMPLEMENTATION_STATUS.md`
- Create: `docs/backend/ARENA_CORE_API.md`
- Create: `docs/backend/ARENA_SERVICE_ARCHITECTURE.md`
- Modify: `scripts/arena-core-live.test.mjs`

- [ ] **Step 1: Write a failing idempotency/live-read test**

Run the seed twice in the approved development environment and assert one current seed week, active divisions, published projects, hidden drafts, skills, rubric criteria, and requirements without duplicate logical rows.

- [ ] **Step 2: Run the seed test to verify RED**

Run: `node --test scripts/arena-core-live.test.mjs --test-name-pattern="seed"`

Expected: FAIL because `db:seed:arena` is unavailable.

- [ ] **Step 3: Add the development-only idempotent seed**

Require `APP_ENV=development`, use deterministic slugs/week code and conflict-safe inserts, seed one to three published projects per active division plus drafts that normal reads cannot return, and never inspect or print environment secrets.

- [ ] **Step 4: Run all Phase 3 and repository quality gates**

Run sequentially: `npm run db:seed:arena` twice, `node --test scripts/arena-core-api.test.mjs`, `node --test scripts/arena-core-live.test.mjs`, existing static auth checks, `npm run test:db:local`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run db:generate`, `npm run db:check`, and `git diff --check`.

- [ ] **Step 5: Document and checkpoint only the scoped files**

Document the endpoint contracts, current-week fallback algorithm, ownership and cache policy, development seed, tests, and deferred scope. Inspect staged names/stat and staged secret scan before creating one local commit: `feat: add Arena core week and project APIs`.
