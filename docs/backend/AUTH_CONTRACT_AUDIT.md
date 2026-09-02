# Side Hustle Arena - Sekolah Karir Auth Contract Audit

## 1. Executive Summary

The canonical Sekolah Karir auth implementation was located in `D:\Sekolah Karir Workspace`. It is a custom Next.js/server implementation backed by PostgreSQL: users authenticate with bcrypt passwords, the server creates an opaque database session, and requests resolve identity and permissions server-side.

The current session cookie is host-only because the implementation sets no `Domain` attribute. There is no evidence of an Arena callback, provider-managed SSO, shared parent-domain cookie, or `arena.sekolahkarir.id` configuration. Direct session reuse is therefore not supported by the observed contract. The safe target is a central auth bridge, pending explicit endpoint and security details from the Sekolah Karir auth owner.

## 2. Arena Current Auth State

Arena remains `MOCK ONLY`. `/login` accepts any values and calls `DemoProvider.login()`. The provider stores the demo user and all application state in browser `localStorage` under `sk-demo-state-v1`. `/app/*` has no server session guard; its layout waits for hydration and renders the app shell. Logout clears demo state and routes to `/`.

The approved login form and modal are visual shells that currently contain demo actions and copy. No Arena cookie, session lookup, route middleware, API auth guard, or server current-user lookup exists.

## 3. Canonical Sekolah Karir Auth Location

Canonical source repository: `D:\Sekolah Karir Workspace`.

Relevant inspected files:

- `src/lib/auth.ts`
- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/logout/route.ts`
- `src/app/api/auth/set-password/route.ts`
- `src/app/workspace/layout.tsx`
- `src/db/schema.ts`
- `docs/AUTH_DB_IMPLEMENTATION.md`
- `docs/SECURITY_NOTES.md`
- `docs/DEPLOYMENT_PREP.md`

The neighboring `D:\Sekolah Karir` and `D:\Sekolah Karir Mobile` directories did not contain a Git repository matching the web auth implementation. No unrelated projects were crawled.

## 4. Auth Technology

Observed mechanism: custom database-backed sessions in a Next.js application using Drizzle ORM and PostgreSQL. Passwords are verified with bcrypt. It is not Auth.js/NextAuth, Supabase Auth, Clerk, or another managed provider based on the inspected implementation.

## 5. Canonical User Identifier

The canonical identifier is `users.id` from `D:\Sekolah Karir Workspace\src\db\schema.ts`, a UUID primary key. It is the foreign-key target for memberships and sessions and is returned as `SessionUser.id` after server-side lookup.

Email is not the Arena identity key. Arena should map the canonical `users.id` value, serialized as a stable subject string, into `identity.users.auth_subject`.

## 6. Session Model

The session is an opaque random ID stored in the `sessions` table. A login or invite activation creates a fresh random session ID and stores it with `userId`, `expiresAt`, and `createdAt`. The documented TTL is 14 days.

`getSessionUser()` reads the cookie server-side, joins `sessions` to `users`, `memberships`, `roles`, and `divisions`, and requires a non-expired row. Role and division are not trusted from the cookie. There is no JWT payload or provider SDK session evidence.

## 7. Cookie Model

Observed cookie name: `skw_session`.

Observed structural configuration:

- HttpOnly: `true`
- Secure: enabled when `APP_URL` has an `https:` protocol
- SameSite: `lax`
- Path: `/`
- MaxAge: 14 days for an active session; `0` when cleared
- Domain: not set, therefore host-only
- Cookie value: opaque session ID only; value intentionally not reproduced

The source does not configure `.sekolahkarir.id`. The current cookie cannot be assumed to reach `arena.sekolahkarir.id`.

## 8. Server-Side Session Verification

Verification occurs in `src/lib/auth.ts` through Next `cookies()` and a database query. The query validates the opaque session ID and expiry, then loads user membership and role/division. Missing, expired, or non-ACTIVE users resolve as unauthenticated. Client-provided user IDs and role payloads are not authoritative.

## 9. Login / Logout Lifecycle

Login is `POST /api/auth/login`: validate email/password, compare bcrypt hash, reject non-ACTIVE users, create a database session, set `skw_session`, and audit the event. Invite activation is handled by `POST /api/auth/set-password` and starts a session after activation.

Logout is `POST /api/auth/logout`: read the current cookie, delete the corresponding session row, clear the cookie, and audit the user logout when identity can be resolved.

There is no Arena login endpoint or canonical cross-domain callback. There is no self-service password-reset flow; the source documentation describes admin re-invitation as the reset path.

## 10. Existing Role / Permission Model

The source has 12 role slugs, including `founder`, `co_founder`, `admin_ops`, `head_partnership`, and functional specialist roles. One `memberships` row per user links the user to a role and division. `src/lib/permissions.ts` maps role slugs to a server-enforced module matrix.

The workspace layout requires a server session. API routes independently call `getSessionUser()` and apply permission helpers. UI visibility and preview mode are not authorization boundaries.

No explicit `arena_admin` role was found. Existing executive roles must not be reused for Arena administration until the auth owner confirms semantic ownership; Arena may need an app-specific authorization policy keyed by canonical subject.

## 11. Existing Subdomain Authentication Evidence

No tracked file in the canonical auth repository references `arena.sekolahkarir.id`, a parent-domain cookie, cross-subdomain SSO, an Arena callback, or an origin allowlist for Arena. `APP_URL` is documented as the public origin used for links and cookie Secure behavior, but no cookie Domain is configured.

The Arena repository contains only the public jobs link `https://jobs.sekolahkarir.id` and branding references. This is not evidence of shared authentication.

## 12. arena.sekolahkarir.id Integration Options

### Option A - Shared parent-domain session

Not supported by current evidence. The existing cookie is host-only, and Arena has no access to the canonical session database or a shared verifier contract. Broadening the cookie would expand its exposure across subdomains and create logout/CSRF coupling. Do not enable by convenience.

### Option B - Central auth redirect + token exchange

Best fit, but not yet implemented by the source system. The auth owner would expose a tightly scoped Arena callback that exchanges a short-lived, one-time authorization code for the canonical `users.id`. Arena would then establish its own host-only session tied to `auth_subject`.

### Option C - Existing managed provider session

Not applicable based on evidence. The observed system is custom bcrypt plus database sessions; no managed provider is present.

### Option D - Existing ecosystem pattern

No proven cross-subdomain pattern was found. The jobs subdomain link is a navigation link only.

## 13. Recommended Integration Pattern

CENTRAL AUTH BRIDGE, with preconditions.

The canonical Sekolah Karir system remains the identity authority. Arena redirects unauthenticated users to an allowlisted canonical login entry, receives a short-lived one-time authorization code at an exact allowlisted callback, validates/exchanges it through the agreed server-side mechanism, maps the returned canonical subject, and creates an Arena-scoped host-only session.

The actual endpoint, code format, client authentication, signing key/backchannel verification, logout propagation, and callback URL remain unresolved. No implementation should begin until the auth owner supplies those details.

## 14. Arena auth_subject Mapping

Recommended mapping:

Canonical: `D:\Sekolah Karir Workspace` `users.id` UUID

Arena: `identity.users.auth_subject`

The Arena email, display name, and avatar fields remain cache fields only. The mapping must be looked up by canonical subject, never by email.

## 15. JIT User Provisioning Recommendation

Use just-in-time provisioning after successful server-side bridge verification: look up `identity.users` by `auth_subject`; insert the mapping if absent; update non-authoritative profile caches from the verified response; continue with the Arena request.

The insert/update must be server-only and idempotent on `auth_subject`. Pre-synchronizing all users is not justified by current evidence and would increase ownership/privacy coupling.

## 16. Admin Authorization Recommendation

Keep identity centralized but define Arena-specific authorization separately. Do not assume `founder`, `admin_ops`, or another Workspace role automatically grants Arena admin powers. Phase 2B should document whether the canonical role claim can express Arena administration; otherwise use a small Arena policy keyed to canonical subjects/verified claims, with server-side checks for every mutation.

## 17. Frontend Mock Auth Replacement Map

| Current mock behavior | Future responsibility | Classification |
|---|---|---|
| `src/app/(public)/login/page.tsx` email/password form | Redirect to canonical auth or invoke approved bridge flow | C - redirect/action wiring |
| `src/components/layout/LoginModal.tsx` | Preserve visual modal shell; route to canonical auth | A/C - shell remains, action changes |
| `DemoProvider.login()` | Remove as authority; hydrate from server session | D - demo action removed |
| `DemoProvider` `state.user` | Replace with server-derived current user adapter | B - data wiring |
| `src/app/(app)/layout.tsx` hydration gate | Add server auth guard while preserving loading shell | B - server guard wiring |
| `DemoProvider.logout()` / reset menu | Call canonical/Arena logout contract; retain reset only for demo mode if needed | B/D - action wiring, demo-only reset |
| `localStorage` key `sk-demo-state-v1` | Stop being authoritative for identity/resources | D - removed from production auth path |

No frontend changes are made in Phase 2A.

## 18. Security Risks

### Critical

- No verified cross-domain contract exists; accepting `skw_session` or a client user ID in Arena would be unsafe.
- Arena currently has no real server authentication or authorization.

### High

- Creating Arena passwords or trusting email would duplicate/fragment identity.
- A broad `.sekolahkarir.id` cookie would increase exposure and create cross-subdomain CSRF/logout coupling.
- Callback replay, open redirects, and forged identity must be prevented by a one-time code, short TTL, state/nonce, exact redirect allowlist, and server-side validation.

### Medium

- No explicit Arena origin/CSRF policy or rate limiting was found in the inspected sources.
- Workspace password changes are not exposed as a normal flow, so password-change session invalidation semantics are not a reusable Arena contract.
- The current 14-day session TTL and logout behavior are local to the Workspace host.

### Low

- Logout is not inherently synchronized across separate host-only sessions.
- No cookie Domain is explicit, so local and production host behavior must be confirmed during bridge design.

### Informational

- Suspended users lose access immediately because every session lookup checks current user status, even though session rows are not necessarily deleted.
- The source documentation mentions `SESSION_SECRET`, but the inspected session implementation uses opaque database IDs and does not expose a signing/verifier contract for Arena.

## 19. Required Phase 2B Changes

- Obtain the canonical auth owner's written bridge contract and ownership approval.
- Add a server-only Arena bridge client with exact callback allowlisting and state/nonce/replay protection.
- Verify the canonical `users.id` subject server-side and JIT-provision `identity.users` by `auth_subject`.
- Establish an Arena-scoped host-only session and define expiry, logout, suspension, and invalid-session behavior.
- Add server authorization helpers that derive all resource ownership from the authenticated subject.
- Define an Arena admin policy without inventing credentials or blindly reusing Workspace roles.
- Replace mock login/logout actions with minimal action wiring while preserving the approved frontend visuals.

## 20. Auth Dependencies / Packages

No packages were installed or modified in Phase 2A. The Arena Phase 1 dependencies remain unchanged. No auth package should be selected until the canonical bridge contract is known.

## 21. Environment Variables Required Later

Observed variable names in the canonical source include `APP_URL`, `SESSION_SECRET`, `DATABASE_URL`, and `ENABLE_*` flags. Values were not read or reported.

Potential Phase 2B names, pending contract, are `AUTH_BRIDGE_URL`, `AUTH_BRIDGE_CLIENT_ID`, `AUTH_BRIDGE_CLIENT_SECRET`, `AUTH_BRIDGE_SIGNING_KEY`, `AUTH_CALLBACK_URL`, `AUTH_ALLOWED_ORIGINS`, and `AUTH_SESSION_SECRET`. These are names only, not configured values.

## 22. Unknowns

- Canonical redirect/login endpoint and callback endpoint.
- Whether the auth owner can issue one-time codes or verify signed responses.
- Arena client registration and server-to-server authentication method.
- Canonical subject claim format and exact serialization of `users.id`.
- Logout propagation and single-session versus multi-session semantics.
- Whether password changes, admin re-invites, or account suspension revoke every session.
- Arena production origin, local callback origins, and CSRF/origin allowlist ownership.
- Whether existing roles can express Arena administration.
- Whether Arena should persist its scoped sessions in PostgreSQL or use another approved server-side mechanism.

## 23. Phase 2B Readiness

READY WITH PRECONDITIONS

The auth source and canonical identifier are known, and `identity.users.auth_subject` is sufficient as-is for the identity mapping. Implementation is not ready until the unresolved bridge, callback, session, logout, role, and origin details are confirmed by the canonical auth owner.
