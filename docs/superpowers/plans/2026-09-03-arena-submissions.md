# Arena Submission and Private Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement server-authoritative mutable drafts, private upload intents, immutable submission versions, technical access validation, and review-attempt accounting for Arena enrollments.

**Architecture:** Existing `arena.submissions`, draft items, and version items remain the source of truth. A small upload-intent table binds pre-signed object uploads to an authenticated enrollment; services own transactions and requirement checks, while route handlers only authenticate, validate, invoke a service, and return no-store responses. A server-only storage abstraction is configured for private Cloudflare R2 but is independently testable without a live bucket.

**Tech Stack:** Next.js 16 route handlers, TypeScript, Drizzle/PostgreSQL, Zod, Node HTTPS/DNS APIs for SSRF-safe link checks, AWS S3-compatible R2 SDK, Node test runner.

---

### Task 1: Write failing contracts and add schema invariants

**Files:** `scripts/arena-submission.test.mjs`, `scripts/arena-submission-live.test.mjs`, `src/server/db/schema/submissions.ts`, `drizzle/0002_*.sql`.

- [ ] Write tests for strict draft/item inputs, HTTPS-only links, private-network URL rejection, lazy submission creation, immutable version snapshots, technical failures consuming no attempt, and concurrency at version/attempt boundaries.
- [ ] Run the tests and capture the missing-service failure.
- [ ] Add `arena.upload_intents`, its ownership/expiry/key constraints, and a partial unique index for non-null review attempt numbers; generate and review one append-only migration.
- [ ] Apply the migration only to the classified Arena development database, rerun it safely, and verify live constraints.

### Task 2: Build private storage and SSRF-safe access foundations

**Files:** `src/server/storage/*`, `src/server/submissions/url-access.ts`, `src/server/submissions/config.ts`, `scripts/arena-submission.test.mjs`, `.env.example`.

- [ ] Add a server-only R2 config/client/object-key/presign/head/delete/download boundary with 10-minute PUT and 10-minute GET TTLs.
- [ ] Add URL parsing, DNS resolution, private/reserved IPv4/IPv6 rejection, pinned-target HTTPS requests, redirect revalidation, timeout, bounded response handling, and no credential forwarding.
- [ ] Verify pure storage/key/SSRF tests pass without live R2 credentials.

### Task 3: Implement draft, item, upload, version, and download services/routes

**Files:** `src/server/submissions/*`, `src/app/api/arena/enrollments/[id]/submission/**`, `src/app/api/arena/submission-items/[id]/download/route.ts`.

- [ ] Add ownership-scoped lazy logical submission creation and mutable draft update/link add-remove operations with server deadline and project-requirement checks.
- [ ] Add presign/finalize flows that bind object keys to unconsumed upload intents, validate HEAD metadata, and never accept arbitrary keys.
- [ ] Add version snapshot creation under a transaction/row lock, requirement enforcement, access validation, valid-only attempt allocation, and immutable version reads/download authorization.
- [ ] Run live development DB tests for IDOR, deadline, lazy creation, item limits, version snapshots, access failure, and attempt/version concurrency.

### Task 4: Verify and checkpoint

**Files:** `docs/backend/SUBMISSION_ARCHITECTURE.md`, `docs/backend/SUBMISSION_API.md`, `docs/backend/R2_DEVELOPMENT_SETUP.md`, `docs/backend/IMPLEMENTATION_STATUS.md`, package scripts/tests.

- [ ] Document object lifecycle, R2 configuration names only, SSRF policy, version/attempt rules, deferred Phase 5 review boundary, and R2-live limitation if credentials remain unavailable.
- [ ] Run lint, typecheck, build, migration generation, auth/DB SSO/Phase 3 regressions, Phase 4 tests, seed twice if changed, and diff checks.
- [ ] Stage only Phase 4 files, scan staged content for secrets without displaying values, and create the requested local checkpoint only if applicable gates pass.
