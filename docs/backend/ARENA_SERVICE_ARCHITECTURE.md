# Arena Core Service Architecture

Phase 3 keeps route handlers thin and places business rules in `src/server/arena`.

| Module | Responsibility |
| --- | --- |
| `errors.ts` | Typed business errors and safe status/body normalization. |
| `schemas.ts` | Strict Zod request, route, and workspace validation. |
| `week-service.ts` | Deterministic persisted lifecycle selection and deadline state. |
| `project-service.ts` | Current-week, active-division, and visible-project reads. |
| `enrollment-service.ts` | Transactional selection and one-user/week enforcement. |
| `workspace-service.ts` | Ownership-scoped workspace reads and deadline-locked lazy upserts. |
| `http.ts` | Uniform no-store API data/error responses. |

The enrollment transaction re-reads the current week, deadline, `week_rules`, project publication, active division, and project/week match before insert. Same-project retries return the existing caller-owned enrollment; a different selection returns a safe conflict. PostgreSQL's `enrollments_user_id_week_id_unique` protects concurrent attempts.

Phase 4 adds `src/server/submissions/` for ownership-scoped drafts, deadline checks, immutable version snapshots, transactional review-attempt allocation, and SSRF-safe link checks. `src/server/storage/` is the server-only private object-storage boundary (Tencent COS, S3-compatible): it creates random keys and short-lived presigned URLs, then validates object metadata after upload. Route handlers never accept browser identity, storage credentials, or client-chosen keys.

Enrollment and workspace reads add both enrollment ID and authenticated user ID to their database predicate. This prevents IDOR disclosure without a client-side ownership decision.

Tests are split into pure contract/lifecycle coverage (`arena-core-api.test.mjs`), live local HTTP/database coverage (`arena-core-live.test.mjs`), and development seed idempotency (`arena-core-seed.test.mjs`).
