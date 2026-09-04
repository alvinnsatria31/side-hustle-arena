# VPS Automation Full Port (Phase 8.5)

Source design: `sekolah-karir-arena` n8n box (`http://202.74.75.95/webhook`),
`arena-eval` grading webhook, milestone ladder + grants, voucher push,
Resend notices. Adapted to this repo's points economy + job queue.

## What moved and how

| Website piece | Here | Adaptation |
|---|---|---|
| `arena-submit` / `arena-publish` / `quest-create` events (app → n8n, `X-Arena-Token`) | `src/server/automation/vps-hooks.ts` (`VPS_WEBHOOK_BASE_URL/TOKEN`), `after()` hook in submit route | Same best-effort contract; `quest-create`/`arena-publish` hook points reserved for the generator phase |
| `arena-eval` webhook (score/feedback/XP in) | `POST /api/webhooks/arena-eval` (`ARENA_EVAL_TOKEN`) + `eval-ingest.ts` | Grader works the same lease pipeline: PENDING job required, server validates + scores. No PENDING job → `{deduped:true}` (retries can't double-score, no extra column) |
| Milestone ladder (XP thresholds, computed entitlement, grant rows) | `src/server/rewards/milestones.ts` + `GET /api/arena/milestones` + `POST …/take` | Re-based on POINTS: steps = active catalog SKUs. Take = PENDING redemption + notice; fulfillment stays Phase 7 |
| Milestone email notice (idempotent rows, never-throw) | `MILESTONE_REACHED` event on threshold crossing (finalize) + `flushPendingEmails` + `POST /api/internal/notifications/flush-email` | Queue-first: no key → stays PENDING (never lost, never fake-sent); no email on file → SKIPPED |
| Voucher push to main site | `src/server/rewards/voucher-push.ts` | CONTRACT PENDING: reports `pushable:false` until `MAIN_SITE_ORIGIN` + `MAIN_SITE_VOUCHER_TOKEN` agreed. Redemption stays PENDING meanwhile |

## Key mapping decisions (PO-confirmed scope: full port)

- Economy: website XP thresholds → Arena points 1:1 against catalog
  `pointsCost`. Ladder reshapes automatically when SKUs activate; the
  2,000 pts → USD 20 SKU stays locked (PRD §35).
- Threshold tuning (exact point values per reward) needs a final PO pass
  before any seed change — current seeds are transitional (see
  `seed-rewards-catalog.mjs`: 1 active + 5 inactive proposals).
- Email sender identity stays on the shared verified domain
  (`ARENA_FROM_EMAIL`, default `noreply@sekolahkarir.id`); key is Arena-owned
  (`RESEND_API_KEY`), never routed via the main site.
- n8n workflow repointing (URLs, tokens, re-activation) is an ops task on the
  VPS, not code — tracked as open ops item below.

## Open ops items (VPS side, not code)

1. Repoint n8n `arena-submit` workflow at this app's submit event shape
   (`enrollment_id`, `version_id`, `attempt`).
2. Repoint grading engine at `/api/webhooks/arena-eval` with `ARENA_EVAL_TOKEN`.
3. Agree main-site voucher contract (`POST /api/v1/vouchers`, idempotent on
   `code`) + mint `MAIN_SITE_VOUCHER_TOKEN`.
4. Provision `RESEND_API_KEY` + schedule `flush-email` (or call on finalize).
5. Provision `VPS_WEBHOOK_TOKEN` on both sides.

## Verification

- `test:vps:automation` (6/6): token-less skip, failure-without-throw, email
  skipped/sent/failed, ladder math, crossing boundaries, voucher
  missing-redemption.
- `test:e2e:reviews`: resubmit → external ingest → run 2 → duplicate
  deduped → `EVAL_INGESTED` audited.
- `test:e2e:finalize`: temp 150-pt SKU → 3× `MILESTONE_REACHED`, ladder
  ready→taken, double-take refused, poor-user take refused, voucher
  contract-pending.
