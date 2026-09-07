# Moving Arena automation to the Sekolah Karir VPS

The n8n workflows on the alvin-team box (`202.74.75.95`) belong to the **previous**
Side Hustle system. They query Supabase, invent their own scores, and pick their
own submissions — none of which the current Arena does. This is the package that
replaces them, running on the Sekolah Karir box (`129.226.94.253`).

Written 7 September 2026. Verified locally with `npm run n8n:dry-run`; nothing on
either VPS was touched.

## The constraint that shapes everything

On the Sekolah Karir box, **only port 22 is public**. Every service listens on
`127.0.0.1` and there is no nginx in front of them.

That single fact settles the architecture: **n8n pulls, Arena never pushes.**

| Direction | Works on the SK box? |
| --- | --- |
| n8n → Arena (`https://arena.sekolahkarir.id/...`) | Yes. Outbound is unrestricted. |
| Arena → n8n (a webhook n8n listens on) | **No.** Nothing can reach it from the internet. |

Both workflows below are pull-only, so both work unchanged. Anything that needs
Arena to call n8n does not, and must not be relied on until someone puts a
public HTTPS endpoint in front of that box.

## What to deploy: two workflows, no overlap

### 1. `arena-trigger-workflow.json` — the clock

n8n says *when*; Arena decides *what* and does all of it. No payload ever carries
a score. Full contract: `N8N_TRIGGER_ONLY.md`.

| Trigger (WIB) | Jobs |
| --- | --- |
| Daily 08:00 | `email-flush`, `week-notifications` |
| Daily 01:30 | `session-cleanup`, `storage-cleanup` |
| Sunday 09:00 | `project-generate` |
| Every hour | `project-drop` |
| Saturday 00:05 | `week-close` |
| Weekend every 2h | `week-finalize` |

### 2. `arena-grading-workflow.json` — the reviewer

Claims one leased job, grades **only** the sources that claim returned, and closes
the same lease. It proposes per-criterion scores; Arena validates the evidence,
decides whether a second judge is needed, and computes the weighted score.
Contract: `N8N_GRADING_WORKFLOW.md`.

### Do not deploy the ad-hoc launch workflow

`arena-adhoc-launch-workflow.json` is triggered by a webhook, which the SK box
cannot receive. It is also redundant: the admin console now has a **Trigger
Workflow** menu (`/app/admin/workflows`) that drives the same
`POST /api/internal/admin/launch` endpoint from the browser, with the same scope
check and the same audit trail. Use the menu.

## Why `reviews-run` is not in the scheduler

`claimReviewJob` is one queue. The scheduler's `reviews-run` job and the grading
workflow's `/api/internal/reviews/claim` both draw from it. Activating both puts
two systems on one queue — the same shape as the legacy Supabase workflows the
VPS audit marked P1.

So `reviews-run` has been removed from the scheduler's trigger map, and the
grading workflow owns reviews. `scripts/project-scheduler.test.mjs` asserts this,
so it cannot quietly come back.

**This also removes a real ceiling.** Running the model inside Arena means running
it inside a Vercel function: 60s on the Hobby plan, with a 45s drain budget that
must cover extraction, the primary review AND a possible second judge. A review
that genuinely needs longer never finishes — it is aborted, handed back, and
retried into the same wall forever. On the VPS there is no function timeout.

`reviews-run` still exists and can be triggered by hand
(`GET /api/cron/reviews-run`) as a fallback. Nothing schedules it.

## Credentials

n8n needs these environment variables. Nothing else.

| Variable | Value | Used by |
| --- | --- | --- |
| `ARENA_BASE_URL` | `https://arena.sekolahkarir.id` | both |
| `ARENA_CRON_TOKEN` | Vercel `CRON_SECRET` | scheduler |
| `ARENA_AUTOMATION_TOKEN` | Vercel `INTERNAL_AUTOMATION_TOKEN` | grading |
| `AI_API_BASE_URL`, `AI_API_KEY`, `AI_REVIEW_MODEL` | the grading model | grading |

Three different tokens on purpose. `CRON_SECRET` runs scheduled jobs,
`INTERNAL_AUTOMATION_TOKEN` claims and closes review leases, `ARENA_EVAL_TOKEN`
is the legacy ingest path. One token for two jobs means one leak costs both.

**Worth checking on this box:** the SK VPS appears to run its own 9router on
`127.0.0.1:20128`. If it does, point `AI_API_BASE_URL` at it. The model call then
never leaves the machine, and Arena stops depending on the alvin box's
`sslip.io` certificate — which is currently a single point of failure for
grading.

## Turn off the push hooks

Arena still tries to POST `arena-submit` / `arena-publish` / `quest-create` to
`VPS_WEBHOOK_BASE_URL`, which defaults to the **alvin** box. Those deliveries
cannot reach the SK box, and pointing them at the old box keeps the retired
system half-alive.

Remove **`VPS_WEBHOOK_TOKEN`** from Vercel. A missing token makes
`src/server/automation/vps-hooks.ts` skip cleanly with a warning; clearing the
base URL instead does nothing, because it falls back to the alvin box's address.

## Order of operations

1. Deactivate `arenagrading0001`, `arenaquestcrea01` and `arenasunday00001` on the
   alvin box. Two release systems writing to two databases is worse than none.
2. Import both JSON files on the SK box. Set the variables above.
3. Verify before activating — see below.
4. Activate the scheduler first, then grading.
5. Remove `VPS_WEBHOOK_TOKEN` from Vercel.

## Verify without waiting for a schedule

```bash
ARENA_BASE_URL=https://arena.sekolahkarir.id \
ARENA_CRON_TOKEN=<CRON_SECRET> \
ARENA_AUTOMATION_TOKEN=<INTERNAL_AUTOMATION_TOKEN> \
npm run n8n:dry-run
```

This reads the same JSON n8n imports, executes the workflow's own router code,
and issues the same authenticated requests. It also checks the review queue with
`GET /reviews/claim`, which reports depth without leasing anything.

If this is green, the contract is sound and anything still failing afterwards is
n8n's configuration — not the workflow.

A `○` means a job is switched off by a feature flag, not broken. n8n's own
summary node is blunter: it treats any `done: false` as a failure, so those will
show red there until the flag is on.
