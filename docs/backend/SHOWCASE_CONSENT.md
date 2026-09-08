# Showcase consent, account deletion and retention

## The rule

**The public Showcase publishes nobody until they say yes.**

`identity.users.showcase_consent_at` is null for every existing row and every
new one. The Showcase queries join on it being non-null, so a participant who
has not opted in is never loaded — the gate is in the join rather than in a
filter afterwards, so no later code path can render one by accident.

Consent is:

- **positive** — a click on the participant's own profile page, never inferred
  from ranking well;
- **timestamped and sourced** — `showcase_consent_at` and
  `showcase_consent_source`, plus an `SHOWCASE_CONSENT_GRANTED` /
  `SHOWCASE_CONSENT_WITHDRAWN` audit row, so "did they agree, and when" is
  answerable later;
- **revocable** — withdrawing removes the entry from the next render, not
  eventually.

An empty Showcase says which of the two reasons produced it: no finalized week
yet, or *n* ranked participants who have not opted in. Those call for opposite
actions, so the page does not blur them.

## Why the leaderboard is different

The weekly leaderboard is not governed by this column, and that is deliberate
rather than an oversight. PRD §103 makes final score, leaderboard and points
public after finalization — it is part of what a participant enters. The
Showcase is the richer surface: it features a named person with their avatar,
their project and a narrative frame, to an audience that did not enter anything.
That is a different act, so it gets its own explicit permission.

If the owner wants the leaderboard consent-gated too, that is a PRD change, not
a bug fix, and it needs a decision about what a leaderboard with holes in it
means for ranking.

## Account deletion

`DELETE /api/arena/me/privacy` with `{"confirm": "HAPUS AKUN"}`, from the
participant's own session. There is an admin path with the same behaviour
(`deleteArenaAccount({ requestedBy: "ADMIN" })`) for a request that arrives by
another channel.

**Erased immediately:** email, display name, avatar, every CV analysis, every
notification and its deliveries, and every workspace note the participant wrote.

**Kept, now anonymised:** rankings, the points ledger, review scores and audit
entries. These are shared, append-only records — deleting a ranking row would
change a finalized week's leaderboard after it was announced to everyone else,
and a ledger that cannot explain a balance is worse than one that names nobody.

**Blocked:** `auth_subject` is rewritten to `deleted:<id>` and the account is
suspended, so the same credential cannot sign back in and re-attach a name to
the surviving history. A returning participant lands on a new account.

Deletion revokes Showcase consent, and an anonymised account is excluded from
the Showcase even if it had consented. Running it twice is a no-op that reports
the original timestamp.

The UI says all of this in plain language before the confirmation, because a
deletion flow that implies more than it delivers is a promise the product
cannot keep.

## Retention

| Data | Retention |
|---|---|
| CV analyses | Opt-in, 50 most recent per participant (`docs/backend/CV_HISTORY.md`), erased on deletion. Raw files are never stored. |
| Auth sessions | Swept by the `session-cleanup` scheduled job. |
| Rate-limit counters | Swept by the same job; ephemeral by construction. |
| Upload intents and orphaned objects | Swept by `storage-cleanup` 24h past expiry when nothing references them. |
| Submission snapshots | Immutable, retained with the version they belong to. |
| Notifications | Erased on account deletion; no separate age-based sweep yet. |
| Rankings, ledger, audit | Retained indefinitely, anonymised on deletion. |

## Tests

- `scripts/career-attribution.test.mjs` — the consent policy itself.
- `scripts/privacy-and-limits.test.mjs` — the Showcase query, consent grant and
  withdrawal, the audit trail, and deletion against a real database, including
  that a finalized week's ranking survives a participant leaving and that the
  deletion audit row does not itself preserve the deleted email.
- `e2e-local/privacy-and-admin.spec.ts` — the whole flow in a browser, plus that
  deletion is behind a typed confirmation.

## Still open for the owner

- Whether an account deletion request should also notify anyone (currently it
  does not, because the participant's notification rows are being erased).
- Whether notifications need an age-based retention sweep independent of
  deletion.
- Whether the leaderboard's PRD-mandated publicity should change.
