# AI Review Pipeline (Phase 5)

PRD basis: §20 core mechanics, §24 evidence rule, §25 structured output,
§26 validator, §27 second judge, §28 blind re-review, §29 improvement
feedback, §30 user-facing output, §31 admin rerun/override, §42 automation vs
user attempts, §43 model profiles, §45 automation audit, §47 cost guardrails.

## Rule of the pipeline

`Submit → Technical Gate → Enqueue → Claim (lease) → Primary Reviewer →
Validator → Confidence/Judge Gate → Optional Second Judge → Backend Score →
Persist (hidden) → Rerun/Override (admin, audited)`

The AI generates and evaluates. The BACKEND controls business state: it
validates output, computes the weighted score, routes the second judge, and
owns ranking/points. The model never writes scores directly.

## Queue (`src/server/reviews/queue-service.ts`)

- `enqueueReviewJob` runs inside the submit transaction for ACCESSIBLE
  versions only (FAILED-access versions queue nothing and consume no attempt).
  Idempotent per version (unique `submission_version_id`).
- `claimReviewJob` atomically leases one job (`SELECT … FOR UPDATE SKIP
  LOCKED` + `UPDATE` in a single transaction): oldest available PENDING first,
  then expired-lease PROCESSING/RETRY (crashed-worker recovery), bounded by
  `MAX_JOB_ATTEMPTS = 5` (automation counter — never the user's 3 attempts).
  Lease: 10 minutes (`JOB_LEASE_SECONDS`).
- `completeReviewJob` verifies the lease, validates, optionally second-judges,
  scores, and persists. `failReviewJob` retries with quadratic backoff
  (`attempt² × 60s`, capped 1h) or fails the job + version after budget
  exhaustion. Worker/model failures never consume a user attempt.

## Reviewer contract (`review-schema.ts`, `reviewer-input.ts`)

- Structured output only: per-criterion `{score, evidence[], issues[],
  confidence}` + strengths + priority improvements + overall confidence.
- Blind input: current version content + rubric ONLY. No previous scores, no
  attempt history, no feedback — anchoring is a design bug, not a feature.
- Improvement comparison (`improved` / `still-needs-work`) is generated only
  AFTER the current score is locked, against the previous VALID attempt.

## Validator, scorer, judge (`validator.ts`, `scorer.ts`, `judge-router.ts`)

- Validator: schema-valid, every criterion covered exactly once, no unknown
  ids (hallucinated anchors rejected), score ≤ criterion max, ≥1 evidence
  string per criterion. Low confidence → warning, not rejection.
- Scorer: `Σ(score/max × weight) / Σweights × 100`, rounded to 2 decimals.
- Second judge runs only when: confidence < `0.70`, validator warnings, or
  unextracted file evidence. It re-reviews independently (judge profile).
  Disagreement ≥ 12 points → `NEEDS_RESOLUTION` (visible to admin, hidden
  from user) instead of a published score.

## Models (`model-router.ts`)

Profiles (`review`/`validate`/`judge`/`generation`) map to concrete models via
configuration — never hardcoded. Today: deterministic `stub-dev-v1`
(reproducible, clearly labeled, `PROMPT_VERSION = arena-reviewer-v1`).
Real provider (OpenAI-compatible) lands with `AI_API_KEY` provisioning; the
pipeline speaks only the `ReviewProvider` interface. The local stub worker
(`worker.ts`) refuses to run outside `APP_ENV=development`.

## Admin (`admin.ts`, `POST /api/internal/reviews/admin/[action]`)

- `rerun`: requeues the version as run N+1. Old review rows stay untouched.
- `override`: appends a `review_overrides` row (before/after + reason +
  actor) and moves `finalScore`. `aiScore` never changes.
- Both skip user-attempt accounting entirely. Internal-bearer gated until the
  admin authorization model lands.

## Worker API (`/api/internal/reviews/*`, bearer `INTERNAL_AUTOMATION_TOKEN`)

- `POST claim {workerId}` → leased job + blind input (file items carry
  short-lived download URLs when storage is configured, else
  `downloadUrl: null` = pending extraction).
- `POST complete {jobId, workerId, output}` → validated + scored + persisted.
- `POST fail {jobId, workerId, code, message}` → retry or fail.
- `GET claim` → queue depth (health dashboard feed).
- Fail-closed: unset token denies everything (no silent open door).

## Audit

Append-only `audit.logs`: `REVIEW_ENQUEUED/CLaIMED/COMPLETED/RETRY/FAILED/
NEEDS_RESOLUTION/RERUN/OVERRIDE`. No update, no delete, ever.

## Tunables (PO may retune with production data)

`REVIEW_CONFIDENCE_MIN` (0.70), `SECOND_JUDGE_DISAGREEMENT_POINTS` (12),
`MAX_JOB_ATTEMPTS` (5), `JOB_LEASE_SECONDS` (600). No code change needed to
retune — they are module constants, not schema.
