# Admin operations

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

## Integration contract

- Generator routes import `requireArenaAdmin` from `@/server/admin/auth` and require `projects`.
- Reward administration uses `fulfillRedemption({ redemptionId, actorSubject, reference, db? })` and `reverseRedemption({ redemptionId, actorSubject, reason, db? })` from `src/server/rewards/redemption-service.ts`.
- Finalization and review business logic remains owned by the parent agent. Administrative routes pass the verified actor into those services.
- No live mutations or external payments were performed.

## In progress

Operational list endpoints, session-gated console, user status audit, reward queue/inventory controls, and final verification.
