# Side Hustle Arena — Database Architecture

## 1. Stack

PostgreSQL is the target database, with Drizzle ORM, Drizzle Kit, `postgres` (postgres.js), and Zod. Migration generation is code-first and offline; this phase does not connect to Neon or apply SQL.

## 2. PostgreSQL Logical Schemas

The database is partitioned into `identity`, `arena`, `rewards`, `notifications`, `automation`, and `audit`. The boundaries separate identity mapping, Arena operations, financial history, delivery history, machine-run history, and immutable audit records.

## 3. Identity Boundary

`identity.users` stores an immutable `auth_subject` mapping plus non-authoritative display caches. Arena stores no passwords, credential records, reset tokens, OAuth tokens, or email-verification tokens.

## 4. Arena Weekly Core

`arena.weeks` owns the dated weekly lifecycle in `Asia/Jakarta`; `arena.week_rules` snapshots per-week configuration. The deadline must be after opening, while transitions and scheduler behavior remain future service work.

## 5. Project Definition Model

Projects are week- and division-scoped, with relational skills, rubric criteria, and submission requirements. Project configuration children can cascade only when a project is legitimately removed; no project publication automation runs in this phase.

## 6. Enrollment Model

`arena.enrollments` is scoped by user, week, and project. Its `UNIQUE(user_id, week_id)` enforces the one-project-per-user-per-week rule; validating that a selected project belongs to that week remains a future service-level check.

## 7. Workspace Model

`arena.workspace_progress` is the mutable draft workspace for one enrollment. It holds plan/checklist-shaped JSON metadata and text without creating review attempts.

## 8. Submission Model

`arena.submissions` is one logical submission per enrollment and carries mutable draft fields. `arena.submission_versions` and their item records are immutable snapshots, ordered by a unique version number. `latest_version_id` intentionally has no foreign key in this first migration to avoid a circular reference; a future service owns its consistency.

## 9. Access Validation Model

Version-level `access_status` distinguishes pending/checking/accessible/failed/not-required. Technical access failures can remain without a review-attempt number, so they do not consume a valid review attempt.

## 10. Review Queue Model

`arena.review_jobs` has one job per submission version and a claim index on status, descending priority, and availability. It is queue storage only: no worker, provider, retry processor, or external automation is implemented.

## 11. Review / Skill Evidence Model

Reviews retain AI and final scores independently so future admin overrides do not overwrite model output. Rubric scores and skill evidence are relational and uniquely scoped to their review/criterion or review/skill.

## 12. Global Leaderboard Model

`arena.weekly_rankings` is global across divisions. Future generation orders eligible entries by `final_score DESC`, then `final_submitted_at ASC`; this phase persists the target constraint and index only.

## 13. Arena Points Model

`rewards.point_ledger` is immutable event history with an idempotency key. `rewards.point_accounts` is a non-negative balance projection for reads. Points never expire, and atomic ledger/account updates are deferred.

## 14. Reward Model

The catalog separates `points_cost` from optional `monetary_value_minor` and currency. The confirmed 2,000-point USD 20 item is a reward SKU concept, not a point-to-currency exchange rate.

## 15. Inventory Model

Inventory periods carry bounded total, reserved, and fulfilled counts. Reservation and fulfillment locking are deliberately not implemented in the schema alone.

## 16. Notifications Model

Events are durable application records; deliveries represent channel attempts and provider references. No email, WhatsApp, Discord, push, or in-app dispatch integration runs in this phase.

## 17. Automation Model

`automation.runs` records idempotent work such as review, finalization, ranking, and notifications. It is an audit-friendly control table, not an implemented scheduler or VPS integration.

## 18. Audit Model

`audit.logs` records actor category, action, target, request ID, and bounded JSON metadata. It must never contain passwords, tokens, session cookies, private signed URLs, or full sensitive document bodies.

## 19. File Storage Boundary

PostgreSQL stores submission metadata only: storage keys, external URLs, MIME types, sizes, checksums, and text content. It stores no file bytes, `BYTEA`, or blobs. Files belong in the private Tencent-COS object-storage boundary.

## 20. Future Transaction Boundaries

Future service transactions must make enrollment creation, review-attempt allocation, review-job claim, week finalization, leaderboard persistence, point distribution, reward redemption, and inventory reservation atomic. None is implemented here.

## 21. Auth Dependency

Phase 2 must map the canonical Sekolah Karir subject into `identity.users.auth_subject`, establish server authorization, and define cookies/subdomain behavior. Arena must not introduce a second credential system.

## 22. CV Boundary

The CV Scanner stays out of scope. No CV tables, file retention, analysis jobs, or storage records are included; a later service may use a separate schema or database.

## 23. Delete / Retention Decisions

Project configuration, workspace drafts, and legitimate draft item cleanup use limited cascades. Reviews, rankings, ledger entries, redemptions, automation runs, and audit logs default to restrictive/no-action references to preserve historical and financial records.

## 24. Security Decisions

`DATABASE_URL` is read only inside lazy server-side database access. There is no `NEXT_PUBLIC_DATABASE_URL`, browser database access, real connection at import time, deployed migration, VPS access, or committed secret.
