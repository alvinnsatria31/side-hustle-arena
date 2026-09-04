# Finalization, Leaderboard & Points (Phase 6–7 core)

PRD basis: §32 fraud separation, §33 leaderboard, §34 points, §62 Friday
finalization flow.

## Flow

`Deadline passes → close (FINALIZING) → pending reviews finish →
finalize (rank + award + publish) → week FINALIZED`

- `closeWeekForFinalization`: deadline-gated (`now >= submissionDeadlineAt`);
  `force` covers admin emergency close/extend, audited. Idempotent.
- `finalizeWeek`: fail-closed preconditions — week must be FINALIZING, zero
  open review jobs, zero `NEEDS_RESOLUTION` reviews. Resolve (rerun/override)
  first, then finalize. Re-running a FINALIZED week is safe (rankings upsert,
  ledger idempotent, accounts move only on new ledger rows).

## Final version selection

Per enrollment: latest version with a non-null review attempt + latest
non-voided `COMPLETED_HIDDEN`/`PUBLISHED` review run. `finalScore` honors
admin overrides (override moves `finalScore`, never `aiScore`). VOIDED
enrollments/submissions/reviews are ineligible — but their score rows stay
(fraud separation: scoring ≠ eligibility).

## Ranking & points

Global, deterministic: `final_score DESC, final_submitted_at ASC, user_id
ASC`. Points: 1→300, 2→200, 3→150, 4+→100. No valid completion → no row, 0
points. Ledger (`point_ledger`, key `finalize:<week>:<user>`) is the source of
truth; `point_accounts` is a projection updated only on new ledger inserts.

## Leaderboard read

`GET /api/arena/leaderboard?week=<code>` (public). Only FINALIZED weeks are
published — anything earlier returns `WEEK_NOT_FINALIZED`. Display names come
from the non-authoritative identity cache with a `Peserta <id>` fallback.

## Void (`POST /api/internal/enrollments/[id]/void`)

Pre-finalize: marks VOIDED, finalize skips it. Post-finalize: additionally
writes a negative `ADMIN_REVERSAL` ledger entry (key `void:<enrollment>`),
decrements the account (floored at 0), and removes the ranking row. Audited
as `FRAUD_VOID` with reason + revoked amount.

## Worker ops (`POST /api/internal/weeks/[action]`)

`close {weekId|weekCode, force?, actorSubject}` and `finalize {weekId,
actorSubject}` — same internal-bearer gate as the review worker API. A real
Friday scheduler (cron/Hermes) calls these; no scheduler lives in-app yet.
