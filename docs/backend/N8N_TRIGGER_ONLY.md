# The trigger-only contract

`n8n/arena-trigger-workflow.json` names this file in its `meta.description`, but
it did not exist — the audit of 7 September 2026 found the dangling reference.
This is that contract, written from the workflow and
`src/server/scheduler/cron-auth.ts` as they actually stand.

Contract version: `trigger-only-v1` (recorded in the workflow's `meta`).

## The rule

**n8n only says WHEN. Arena decides WHAT and does all of it.**

No payload from n8n ever carries a score, a ranking, a point total, or a
decision. The request body is empty; the whole instruction is the job name in
the URL. Everything that could affect a participant's result — model calls,
validation, second-judge routing, weighted scoring, finalization, point awards —
happens inside Arena, against Arena's own data, under Arena's own guards.

This matters because the scheduler is the one component running outside the
deployment. Treating it as a clock rather than as a worker means compromising it
buys an attacker the ability to run scheduled jobs early, and nothing else: no
way to inject a grade, and no way to award a point.

## The call

```
GET {ARENA_BASE_URL}/api/cron/{job}
Authorization: Bearer {ARENA_CRON_TOKEN}
```

- **Method is GET even though the jobs write.** Access is gated by the bearer
  token in `requireCronCaller`, never by the method — Vercel Cron issues GETs,
  and matching that keeps one entrypoint instead of two.
- **The token** must equal either `CRON_SECRET` or `INTERNAL_AUTOMATION_TOKEN`
  on the Arena side. Both are accepted so an operator can trigger a job by hand
  during an incident without a second class of credential. Comparison is
  constant-time. With neither variable set, every call is refused — a
  half-configured environment fails closed rather than leaving the scheduler
  open to the internet.
- **n8n needs two environment variables**: `ARENA_BASE_URL` and
  `ARENA_CRON_TOKEN`. Nothing else.

## Jobs, and which trigger owns them

| n8n trigger | Jobs |
| --- | --- |
| Every 2 minutes | `reviews-run` |
| Daily 08:00 WIB | `email-flush`, `week-notifications` |
| Daily 01:30 WIB | `session-cleanup`, `storage-cleanup` |
| Sunday 09:00 WIB | `project-generate` |
| Monday 07:00 WIB | `project-drop` |
| Saturday 00:05 WIB | `week-close` |
| Weekend every 2h | `week-finalize` |

The mapping lives in the workflow's "Which jobs are due" node. The authoritative
list of job names is `JOBS` in `src/server/scheduler/service.ts`; an unknown name
returns a validation error rather than doing nothing quietly.

## Why n8n and not Vercel Cron

`vercel.json` still declares the same jobs, and those entries are real, but the
Hobby plan cannot schedule below daily granularity. `reviews-run` needs to fire
every couple of minutes or a submitted project waits hours for its review, so
n8n — which has no such limit — is the scheduler that actually matters. The
Vercel entries are a coarse safety net, not the primary path.

A consequence worth stating plainly, because it has caught people before: the
presence of `n8n/*.json` in this repository proves a workflow was *designed*, not
that one is *running*. The JSON is an import artifact. Whether the workflow is
active on the n8n instance is a separate operational fact that has to be checked
there.

## What the response means

Every job returns `{ data: { job, done, detail } }`.

- `done: true` with `detail.skipped` — the normal quiet case. The job looked for
  work, found none, and stopped. Not an alert.
- `done: true` with counts — it did something.
- `done: false` — it could not finish. The workflow's "Summarise the run" node
  treats this and any non-200 as the failure signal.

A job that cannot complete *yet* (reviews still running when a week wants to
finalize) reports itself as waiting and stays `done: true`. The schedule is the
retry mechanism; nothing needs to be requeued by hand.

## Firing more often than needed is safe

Every job is idempotent and self-gating: it finds its own work, refuses to act
past its own guards, and reports `skipped` when there is nothing to do. Firing
late is recoverable for the same reason — the next tick picks up whatever the
missed one would have done. This is what lets the 2-minute tick exist without a
lock or a queue in n8n.

## Timeouts

The n8n HTTP node waits 120s. Arena's cron route declares `maxDuration = 60`,
the free-plan ceiling, and `reviews-run` bounds itself well inside that: its
drain budget (`ARENA_REVIEW_DRAIN_BUDGET_MS`, 45s) is passed down into the model
call, so a slow provider is cut off by the tick rather than by the platform
killing the invocation mid-review. n8n waiting longer than Arena can possibly run
is deliberate — the client should never be the thing that gives up first.

## Related

- `n8n/arena-adhoc-launch-workflow.json` — off-schedule project release. That one
  is *not* trigger-only: it posts to `/api/internal/admin/launch` with a
  `INTERNAL_ADMIN_TOKEN` bearer and admin scopes. See
  `docs/backend/ADMIN_OPERATIONS.md`.
- `docs/backend/IMPLEMENTATION_AUDIT_2026-09-07.md` — finding 2, on not mistaking
  a stored workflow for an active one.
