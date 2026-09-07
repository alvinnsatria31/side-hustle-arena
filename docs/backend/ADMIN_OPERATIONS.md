# Admin operations

## Trigger Workflow menu (7 September 2026)

Project admins can open `/app/admin/workflows` from **Trigger Workflow** in the
sidebar, without needing the `overview` scope. The form calls the existing
session-authenticated `/api/internal/admin/launch` endpoint: create a week,
generate projects for active divisions, and optionally approve/publish.

**Buka sekarang** sets the opening time at submission, so a manual run is not
held until Monday or today's 08:00. A custom opening time and deadline use WIB.
The default is preview; **Setujui dan publikasikan langsung** explicitly skips
the preview wait. Deadline must be future and after opening, and an audit reason
is required. Further attempts with a returned week ID reuse that week; once
any project publishes the form stops launching again. Project/deadline/feature
guards in the backend remain authoritative.

If a dispatched request fails without a reliable result, the form blocks another
submission and directs the operator to inspect Projects: the server may already
have created or published the week. Validation failures before dispatch remain
editable. This avoids a blind retry creating another release; it is not a
server-side idempotency guarantee across reloads or concurrent browser tabs.

Manual launch does not change the generation or auto-publish flags, Vercel
cron, or the recurring n8n workflow. Scheduled weekly generation/publication
continues when configured and activated. The Otomasi page links to this form
and retains individual scheduled jobs and readiness diagnostics.

## Completed: authorization separation

- `src/server/admin/auth.ts` exports `requireArenaAdmin(request, scope): Promise<{ actorSubject: string }>` and the session-only `requireArenaAdminSession()` console gate.
- Scopes: `overview`, `reviews`, `weeks`, `projects`, `rewards`, `users`, `storage`.
- Existing overview, flag, review rerun/override, week close/finalize, and enrollment void routes now require admin authorization. Worker credentials cannot authorize these operations. Request-body actor fields are ignored; the guard supplies the audit actor.
- Session mutations use the existing `hasAllowedMutationOrigin` checker. Explicit invalid bearer credentials never fall back to a session.
- Check: `node --test scripts/admin-auth.test.mjs`: 6 passed, 0 failed (2026-09-05). Tests execute real authorization and route modules with session/persistence boundaries stubbed; no database mutations.

## Required server configuration

No environment files, packages, or schemas were changed.

| Variable | Meaning |
| --- | --- |
| `ARENA_ADMIN_SUBJECTS` | Comma/whitespace-separated exact canonical `identity.users.auth_subject` values; grants every scope. Example: `sk-participant:123`. Never use email or display name. |
| `ARENA_ADMIN_ROLES` | Optional JSON object mapping exact canonical subjects to arrays of scopes. Example: `{"sk-participant:456":["reviews","overview"]}`. Invalid JSON, non-object maps, or unknown scopes fail closed. |
| `INTERNAL_ADMIN_TOKEN` | Optional separate bearer secret for operator integrations. Never reuse `INTERNAL_AUTOMATION_TOKEN`; equal values deny token access. No default or fallback token. |
| `INTERNAL_ADMIN_SUBJECT` | Required nonempty server-configured audit subject for admin bearer requests, e.g. `service:arena-ops`. |
| `INTERNAL_ADMIN_SCOPES` | Required comma/whitespace-separated scopes for the admin bearer token. No implicit all-scopes access. |

Keep every variable server-only. Browser operations use the participant session; bearer credentials never authorize the console page.

## Reaching the console

`/app/admin` has no public link. The avatar menu in the signed-in navbar shows an
**Admin** entry only when the session subject holds at least one scope, which
`arenaAdminScopesFor` (same allowlist as the guards, non-throwing) decides in
`src/app/(app)/layout.tsx`. The flag is presentation only — every admin page and
route still runs its own gate, so a stale or forged flag reaches nothing. Until
`ARENA_ADMIN_SUBJECTS` or `ARENA_ADMIN_ROLES` names a subject, nobody sees the
entry and `/app/admin` redirects to `/app`. Copy the value from
`identity.users.auth_subject` after the intended admin has signed in once.

## Integration contract

- Generator routes import `requireArenaAdmin` from `@/server/admin/auth` and require `projects`.
- Reward administration uses `fulfillRedemption({ redemptionId, actorSubject, reference, db? })` and `reverseRedemption({ redemptionId, actorSubject, reason, db? })` from `src/server/rewards/redemption-service.ts`.
- Finalization and review business logic remains owned by the parent agent. Administrative routes pass the verified actor into those services.
- No live mutations or external payments were performed.

## In progress

Operational list endpoints, session-gated console, user status audit, reward queue/inventory controls, and final verification.

## Console layout

`/app/admin` is a left rail plus a canvas, not a page inside the participant
shell. `AppChrome` drops the participant navbar and bottom tab bar under
`/app/admin` — two navigations leading to different places is worse than one,
and the tab bar covered the tables. `AdminSidebar` groups the sections
(Konten, Operasi, Orang & Reward, Sistem) and filters them by the caller's
scopes, the same way the guards do.

## Off-schedule project release

The weekly cycle assumes Monday: `prepareScheduledWeek` refuses to run outside
the Sunday window, so "give participants something on Tuesday" had no path
through the system. `POST /api/internal/admin/launch` (scope `projects`,
`src/server/admin/launch.ts`) composes the steps that already existed:

1. create the week for the chosen opening time, or reuse one still in
   DRAFT/PREVIEW/SCHEDULED;
2. generate one project per active division, using the configured model or the
   curated library when no model is set;
3. optionally approve — which is what skips the minimum preview interval;
4. optionally publish, which opens the week.

Every step reports rather than throws where the domain says "not yet": a
release prepared for Tuesday cannot publish on Monday, and that is the correct
answer to show an operator. Only a step that genuinely failed stops the ones
that depend on it. Both `ADHOC_LAUNCH_STARTED` and `ADHOC_LAUNCH_FINISHED` are
written to `audit.logs` with the actor the guard supplied.

`ARENA_GENERATION_ENABLED` is deliberately **not** consulted here. That flag
governs the unattended timer; gating the console behind it would mean the
console could not be used to recover when the timer is off.

### Driving it from n8n

`n8n/arena-adhoc-launch-workflow.json` is a webhook (header-auth) plus a
disabled Tuesday schedule, both calling the same endpoint. n8n needs no bespoke
authentication: `requireArenaAdmin` already accepts `INTERNAL_ADMIN_TOKEN`, so
set `ARENA_BASE_URL` and `ARENA_ADMIN_TOKEN` in n8n and give
`INTERNAL_ADMIN_SCOPES` the `projects` scope. The token must not equal
`INTERNAL_AUTOMATION_TOKEN` — equal values are denied outright. The workflow
leaves `approve` false by default so unattended runs prepare a release for a
human to approve.

## Automation page

`/app/admin/jobs` runs the same jobs `n8n/arena-trigger-workflow.json` fires on
a timer, with an admin session instead of the cron secret, so an off-schedule
tick never requires handing that token to a person. Each job is mapped to the
scope that owns it in `src/server/admin/jobs.ts`; the `satisfies Record<JobName,
…>` there is load-bearing, since a job added to the scheduler without a scope
fails the build rather than reaching the console ungated.

The page also reports readiness. Jobs are self-gating and report `skipped`
rather than failing when their switch is off — correct for a timer, but a shrug
to an operator who just clicked a button — so the console reads the same
configuration up front and says which jobs are inert and why. The production
checklist reports only whether each secret is **set**; values never reach a
browser.
