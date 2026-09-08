# Remediation record — 8 September 2026

Follow-up to [`IMPLEMENTATION_AUDIT_2026-09-08.md`](./IMPLEMENTATION_AUDIT_2026-09-08.md),
which found A01–A07 against `1b8affb`. This document records what changed, what
proves it, and what is still open. Where the audit and this document disagree,
this one is later.

Nothing here was deployed, pushed, or run against a shared environment. Database
work ran against the loopback sandbox (`arena_local`); the browser suite runs
against that same sandbox on `localhost:3001`. No live bucket, no live n8n, no
email, no paid provider, no payout.

---

## Phase 1 — correctness and security (A01–A05)

### A01 — submitted files are now immutable

**Was:** `createImmutableSnapshot()` existed but nothing called it. A version row
copied the *draft* object key, which a still-valid presigned PUT can overwrite.
The reviewer then compared only the file's **size** — so a replacement of equal
length passed every check, and the review graded bytes the participant never
submitted.

**Now:**

- `finalizeArenaUpload` records the SHA-256 of the bytes it actually read.
- `submitArenaSubmission` freezes every draft file into a write-once
  `snapshots/` object (`If-None-Match: *`, read back before it is trusted)
  *before* allocating the review attempt, so a storage failure never burns one
  of the participant's three attempts.
- The version row references the snapshot key and its checksum. A FILE item
  without a snapshot is a hard error, never a fall-through to the draft key.
- `ensureReviewSources` verifies **identity**, not size: `downloadObjectBytes`
  with the recorded checksum, then `assertArtifactIdentity`. A row with no
  recorded checksum is treated as unverifiable rather than as probably fine.

**Files:** `src/server/submissions/version-core.ts` (new),
`src/server/submissions/service.ts`, `src/server/reviews/artifacts.ts`,
`src/server/storage/cleanup{,-core}.ts`.

**Proof:** `scripts/submission-immutability.test.mjs` (equal-size replacement
rejected, write-once snapshot key, refusal when the draft changed between
finalize and submit) and — the one that matters —
`scripts/arena-lifecycle-integration.test.mjs`, which uploads through a real
presigned PUT to the sandbox object store, submits, **replays the PUT with
equal-size different bytes**, and asserts the reviewer still reads the original.

**Also fixed here:** orphan cleanup. `cleanupExpiredUploads` skipped consumed
intents, which is exactly the shape an orphan takes (a draft item deleted after
its object delete failed). Reference lookups now decide, not the consumed flag.

### A02 — the review queue can no longer lose or corrupt a job

**Was:** a worker that died after winning the fifth attempt left `PROCESSING`
with a dead lease that nothing could claim — and finalization counts that as an
open job, so the week never closed. `failReviewJob` checked only `lockedBy`,
which survives completion, so a worker reporting a local timeout could flip an
already-COMPLETED job back to RETRY. Admin rerun required an existing review, so
a first review that failed had no recovery button at all.

**Now:**

- `src/server/reviews/queue-policy.ts` (new) holds the lease rules as pure
  functions: `classifyLease`, `isAbandonedAtAttemptLimit`, `canAdminRequeue`.
- `sweepAbandonedReviewJobs` retires stranded jobs as FAILED (one conditional
  UPDATE), and runs at the start of every claim and before finalization.
- `failReviewJob` takes the same lease, under the same row lock, as completion:
  a stale callback is reported back as `applied: false` with a reason and
  audited, never obeyed. The write is conditional on
  `(status, lockedBy, attemptCount)`, so a lost race reports itself.
- `handleInvalidOutput` uses the same conditional guard.
- `rerunReview` recovers a version whose first review never produced a row, and
  refuses to steal a job from a worker holding a live lease.

**Proof:** `scripts/review-recovery.test.mjs` — lease classification, the fifth
attempt, late failure against COMPLETED, expired-lease and wrong-worker
callbacks, the conditional-write race, sweeping on claim, and both admin rerun
paths. SQL predicates are asserted through `PgDialect`, so the guard itself is
covered rather than just the branch.

### A03 — a failed retry no longer erases a valid result

**Was:** `collectEligibleFinalists` took the newest version with an attempt
number, then looked for a review only on *that* version. A participant who
scored on attempt one and whose attempt two failed terminally was dropped from
the week entirely.

**Now:** `src/server/finalization/finalist-core.ts` (new) walks versions
newest-first and takes the first that is genuinely finalizable — accessible,
attempt-consuming, with a completed or published review carrying a real score.
`Number(null)` being 0 is handled explicitly, so a null score cannot rank as a
legitimate zero.

**Proof:** `scripts/finalist-selection.test.mjs`, including V1-succeeded /
V2-terminally-failed.

### A04 — one execution contract, enforced

**Was:** the cron route declared 60s and the internal review route declared 300s
for identical work; the drain budget started counting *after* extraction had
already run; OCR gave itself 60s per image inside a 60s invocation; the n8n
grading workflow picked a 30s claim timeout independently. A request could be
killed by the platform while every component believed it was within its limit.

**Now:** `src/server/ops/execution-budget.ts` (new) is the single source of
those numbers, with an `ExecutionBudget` that counts down, refuses work it
cannot finish, and produces abort signals that never outlive the deadline.

- The review budget starts **before** the claim, because the claim is where
  extraction and OCR happen; a tick refuses to claim a job it cannot finish.
- Extraction and artifact fetching take the caller's budget; whichever deadline
  comes first wins.
- The second judge is refused when there is not room for it *plus* the
  persistence reserve — thrown before any review row exists, so the job retries
  with a fresh budget and the participant loses nothing.
- Weekly generation is budget-bounded and resumable: it takes divisions while
  there is room, commits what it did, and reports `deferredDivisions`. The
  generation trigger now fires hourly through the Sunday window instead of once.
- Route ceilings all state the same number, and the n8n grading workflow's
  timeouts are derived from the contract with the lease invariant asserted.

**Proof:** `scripts/execution-budget.test.mjs` and
`scripts/automation-contract.test.mjs` — the latter reads the n8n JSON,
`vercel.json` and the route files and fails when they drift from the contract.

### A05 — email retries can actually be taken

**Was:** the flush ran once a day against a policy promising six retries inside
a 23-hour idempotency window. The second attempt landed 24 hours after the
first — already expired. Every failed message got exactly one attempt.

**Now:**

- `flushCadenceIsSafe(intervalMs)` states the requirement as a function of the
  backoff ladder, the attempt budget and the window.
- The n8n trigger fires `email-flush` **every 15 minutes**, and the scheduler
  contract test fails if that cadence stops satisfying the policy.
- One tick drains the backlog rather than stopping at 100, bounded by the
  invocation budget, and reports `backlogRemaining` instead of implying it
  finished. Week broadcasts repeat rounds the same way.

**Proof:** `scripts/execution-budget.test.mjs` (the daily cadence is asserted
*unsafe*, the configured one safe) and `scripts/automation-contract.test.mjs`.

---

## Phase 2 — P2 findings (A06, A07)

### A06 — placeholder content can no longer be published

`validatePackage` now rejects unwritten markers (`[PLACEHOLDER]`, `TBD`, `TODO`,
lorem ipsum, `<ANGLE_CAPS>`) in every reader-visible field, including the rubric,
the requirements and the fingerprint. The one escape hatch is
`allowPlaceholders`, used only when registering a **`NEEDS_CURATION`** library
template — a new tag whose whole purpose is to freeze a division's base rubric
so generation can start, and which the generator's candidate pool excludes. The
bootstrap script registers `NEEDS_CURATION`, never `HIGH_QUALITY`.

Library rejections now carry the real reason instead of `invalid_or_duplicate`,
so an operator staring at a held week can tell "duplicate" from "still full of
placeholder text".

**Proof:** `scripts/generation-placeholder.test.mjs`.

### A07 — the "true E2E" script is replaced

`scripts/true-e2e-test.mjs` is **deleted**. It called itself a true business
end-to-end test while never uploading a file, hardcoding sandbox credentials and
a session secret in source, claiming from the *global* review queue (so two runs
could grade each other's work), downgrading a points mismatch to "INFO" so the
run still reported ALL PASSED, leaving every fixture row behind, and calling
`process.exit` over it.

`scripts/arena-lifecycle-integration.test.mjs` (`npm run test:local:lifecycle`)
replaces it: a real `node:test` suite, credentials from the generated sandbox
env file, a genuine presigned PUT, the run's **own** job claimed by id, hard
assertions on points and ranking, and full cleanup on pass or fail.

Removing it also cleared 9 of the 27 lint warnings.

---

## Phase 3 — Jobs end-to-end automation

Six hardcoded fictional openings replaced by a provider-agnostic pipeline. Full
operations guide: [`JOBS_PIPELINE.md`](./JOBS_PIPELINE.md).

- **Schema** (`0012`): `job_sources`, `job_openings`, `job_opening_skills`,
  `skill_aliases`, `job_sync_runs`.
- **Ingestion**: a one-method `JobsAdapter` seam, an `http-json` adapter with
  cursor pagination, retry with backoff, Retry-After handling, size limits and
  budget-bounded aborts, and a sandbox-only fixture adapter.
- **Normalization**: total and pure. A field the provider did not supply comes
  back `UNSPECIFIED`/null, never a plausible default; application URLs are held
  to the product's HTTPS rule; malformed records are counted and skipped.
- **Idempotency**: per-source lease, keyed run row, keyed upsert. Absence is
  graded (`STALE` → `CLOSED`) and only after a sweep that **completed**, so one
  failing page cannot close a board. Nothing is deleted.
- **Matching**: taxonomy IDs, not strings. Coverage is `null` — with a stated
  reason — when the role listed no skills or the participant has no finalized
  evidence, because `0%` reads as "you match nothing".
- **API/UI**: `/api/career/jobs` reads the database; the page shows source,
  health, freshness, status, filters, unmapped skills, and an outbound
  application link. No sample data can reach production: it was deleted, and the
  fixture adapter refuses to run outside the sandbox.
- **Automation**: `jobs-sync` scheduled job, n8n trigger every four hours,
  `/app/admin/careers` for health and manual sync, audit rows carrying totals
  and error codes only.

**Proof:** `scripts/jobs.test.mjs` (35 offline, including a loopback HTTP
server), `scripts/jobs-pipeline-integration.test.mjs` (18 against the sandbox
database, including concurrency and the admin API routes),
`scripts/automation-contract.test.mjs`, and the browser specs.

**Not done, because it needs the owner:** which provider. See the end of
`JOBS_PIPELINE.md`.

---

## Phase 4 — the rest of Career

### Skill evidence attribution (migration `0013`)

Finalization wrote the project's overall score onto **every** skill: an 82
became "Excel 82, SQL 82, Communication 82", and nothing downstream could tell
that was one number wearing three hats.

A rubric criterion can now name the skill it measures
(`project_rubric_criteria.skill_id`). `attributeSkillEvidence` computes a real
per-skill score from the criteria that measured it, normalising across different
maximums and weighting properly. Where nothing is attributed, the row is still
written — the participant did the work — but tagged `PROJECT` with
`criterion_count = 0`, and the Career Report **shows no score at all** for it,
only the project score as separate context. Measured and inherited evidence are
never averaged together, and a skill nobody measured cannot outrank one somebody
did.

### One skill vocabulary

`src/server/career/skill-taxonomy.ts` builds one index from skills plus curated
`skill_aliases`, used by Jobs ingestion, the Career Report's CV join, and CV
matching. A curated alias beats a derived key; derivation stays mechanical
(punctuation, vendor prefixes) and never invents synonyms.

### Showcase consent and account deletion (migration `0014`)

Private by default, published only on a positive timestamped act, revocable, and
excluded for suspended or deleted accounts. Account deletion erases the person
and keeps the shared arithmetic. Full rationale:
[`SHOWCASE_CONSENT.md`](./SHOWCASE_CONSENT.md).

While testing this, the Showcase's "latest finalized week" query was found to
sort `NULL` finalization timestamps **first** (Postgres `DESC` default) — so a
week marked FINALIZED without a timestamp would be featured over a real one.
Fixed with `nulls last`.

### CV limiter

The per-IP limit caps one script; it is not a spend cap. Added a total hourly
ceiling across all callers (`CV_SCAN_HOURLY_CAP`, default 300), refused with its
own message and log line, plus `getSpendWindow` for the admin view — which
reports "cannot read the counter" rather than "zero", because those are opposite
facts. Concurrency is now proven against a real database, not a mock.

### Reviewer input

The reviewer now receives the project **brief** (case background, role, mission,
objective) — blind to previous *judgements*, as PRD §28 requires, not blind to
the assignment — and an explicit `evidenceLimits` list stating what this evidence
cannot support (images arrive as OCR text; links are fetched, not clicked). The
n8n grading workflow reports which model graded, so `reviewModel` stops being
the literal string `external-worker`.

### Operational visibility

`src/server/ops/automation-health.ts` reports states an operator can act on —
stranded review jobs, expired leases, email aging past half the idempotency
window, unhealthy jobs sources, overdue job heartbeats, CV spend — each with the
number that produced it and what to do. The cron entrypoint now writes a
heartbeat row per scheduled run, which is what makes "this timer stopped a day
ago" answerable at all. Surfaced at the top of `/app/admin`.

### Browser coverage against the sandbox

`playwright.sandbox.config.ts` + `e2e-local/` (`npm run test:browser:local`):
17 specs over Jobs, Career Report, Arena, CV scanner, Showcase consent grant and
withdrawal, deletion confirmation, admin readiness, admin jobs sources, and the
signed-out / wrong-scope error paths. Unlike `playwright.config.ts`, this suite
runs entirely on loopback Postgres and MinIO, so it needs no shared environment
and no live bucket.

---

## Verification

See the final section of the session report for exact commands and counts.
Summary: `typecheck` pass, `db:check` pass, `lint` 0 errors / 18 warnings (down
from 27), `test:offline` 263 pass / 0 fail (from 167), `build` pass, plus 41
sandbox database tests and 17 browser tests.

## Still open

- **Jobs provider** — the only thing standing between this pipeline and live
  openings.
- **Live verification** — COS, n8n, email, SSO, Vercel: unchanged by this work
  and still unproven, by design.
- **Rubric attribution is opt-in** — existing projects have no
  `project_rubric_criteria.skill_id`, so their evidence is `PROJECT`-attributed
  and shows no per-skill score until a curator maps criteria to skills. That is
  the honest state, not a regression; the admin editor does not yet expose the
  mapping.
- **Cross-device logout** still needs the main site's revocation contract.
- **Rewards, payout, vouchers** — untouched, on hold by instruction.
