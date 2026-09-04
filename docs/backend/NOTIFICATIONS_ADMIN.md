# Notifications & Admin Backend (Phase 8 slice)

PRD basis: §36 notification model, §37 admin dashboard, §46 health.

## Notifications

- The event row IS the notification (`notifications.events` + `deliveries`).
  Entitlement to know never depends on a delivery provider — same safety
  property as the website's milestone nudge.
- `notify()`: writes the event + deliveries. `IN_APP` completes
  synchronously (the inbox); other channels land `PENDING` for a future
  sender worker (Resend/WA/Discord — not built yet).
- `notifyBestEffort()`: for triggers inside user flows. A notification must
  never break a submit or an award — failures are logged and swallowed.
- Triggers live today: `SUBMISSION_RECEIVED` / `SUBMISSION_ACCESS_FAILED`
  (submit), `RESULT_READY` + `POINTS_AWARDED` (finalize, per ranked user).
  `PROJECT_DROP` / `DEADLINE_REMINDER` are scheduler-owned via
  `POST /api/internal/notifications/broadcast` (Hermes/cron; no in-app
  scheduler yet).
- User inbox: `GET /api/arena/notifications?unread=1&limit=` (items +
  unread count), `POST /api/arena/notifications/read` (`{eventIds}` or
  `{all:true}`). Always session-scoped — no cross-user reads.
- Review results stay hidden until finalization: there is deliberately NO
  "review completed" user notification (PRD review-hiding rule).

## Admin backend (browser UI pending)

- `GET /api/internal/admin/overview`: week state, enrollment/version counts,
  review queue depth, `NEEDS_RESOLUTION` backlog, all four flags + states,
  catalog active/total, redemptions by status, last 20 audit rows.
- `POST /api/internal/admin/flags {key, closed, message, actorSubject}`:
  audited kill-switch flips; unknown keys rejected.
- Already API-ready from earlier phases: finalize/close/void
  (`/api/internal/weeks|enrollments`), review rerun/override
  (`/api/internal/reviews/admin`), reward catalog read.
- Still pending: browser admin dashboard (uses the endpoints above),
  redemption fulfillment flow (Phase 7), admin role model (auth decision).

## PRD §37 coverage map

| Capability | Status |
|---|---|
| inspect/edit/veto/regenerate/publish/hold projects | API: publish states exist; edit/veto/regenerate await generator phase |
| close/extend week | DONE (`weeks/[action]` close + force) |
| review queue status/rerun/override | DONE (overview + review admin routes) |
| generator health/retry/fallback/publish-now | pending Hermes generator phase |
| rewards catalog/redemption/fulfillment/reversal | catalog read DONE; redemption flow pending |
| suspend/fraud void/audit trail | void DONE; suspend = user status flag, pending admin UX |
| Hermes/worker heartbeat/queue depth/failures | queue depth + audit DONE; worker heartbeat pending Hermes phase |
