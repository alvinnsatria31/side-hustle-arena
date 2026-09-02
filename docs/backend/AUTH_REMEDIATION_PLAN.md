# Arena Authentication - Security Remediation Plan

This plan is based on the Sol audit of Arena `09cc39d` and Canonical `98c325e`. It authorizes no source change by itself. Implement each item in a separately approved phase and rerun both repositories' quality gates plus the named regression tests.

## Blocking Before Integration Test

NONE.

No Critical or High finding was confirmed. An isolated, non-production, database-backed integration test may proceed after explicit database/migration authorization. Production deployment may not proceed until the Medium items below are remediated or, where stated, formally risk-accepted.

## Required Before Production

### Priority P1 - Prevent Canonical login CSRF/session swapping

Priority: P1

Finding ID: `SOL-AUTH-001`

Repository: Canonical / Both

Files likely affected:

- `D:\Sekolah Karir Workspace\src\app\api\auth\login\route.ts`
- `D:\Sekolah Karir Workspace\src\app\login\page.tsx`
- A focused Canonical auth integration test file

Minimal change:

- Validate the exact Canonical browser Origin and reject missing/mismatched origins under the chosen browser policy.
- Require the intended JSON/custom-header request shape or add a login CSRF token.
- Keep identical authentication failure bodies and preserve current host-only cookie scope.

Required regression test:

- Reject cross-site, sibling-origin, missing-Origin, and `text/plain` credentialed login attempts without setting `skw_session`.
- Accept the legitimate Canonical login page request.
- Prove a rejected request cannot alter the subject later returned by Arena authorize.

Recommended implementation model: Terra. Request Sol review afterward because this changes a security-sensitive login boundary.

### Priority P1 - Add authentication abuse throttling

Priority: P1

Finding ID: `SOL-AUTH-002`

Repository: Canonical / Both

Files likely affected:

- `D:\Sekolah Karir Workspace\src\app\api\auth\login\route.ts`
- `D:\Sekolah Karir Workspace\src\app\api\sso\arena\authorize\route.ts`
- `D:\Side Hustle Arena\src\app\auth\login\route.ts`
- `D:\Side Hustle Arena\src\app\auth\callback\route.ts`
- Deployment/runtime limiter configuration selected for the approved environment

Minimal change:

- Rate-limit Canonical password login by IP and normalized account dimension without revealing account existence.
- Add coarser limits for authorize and Arena flow initiation/callback.
- Keep token/introspection/revoke behind the current client secret and apply conservative service-level request limits.
- Add request-size limits and observable 429 metrics.

Required regression test:

- Verify thresholds, recovery window, 429 behavior, known/unknown account equivalence, and no bypass through alternate content type or callback churn.

Recommended implementation model: Terra.

### Priority P1 - Resolve the five-minute revocation/suspension window

Priority: P1

Finding ID: `SOL-AUTH-003`

Repository: Both

Files likely affected:

- `D:\Side Hustle Arena\src\server\auth\session.ts`
- `D:\Side Hustle Arena\src\server\auth\config.ts`
- Canonical revocation integration only if a back-channel signal is selected

Minimal change:

- Decide and document the maximum acceptable stale-access window.
- Either explicitly accept 300 seconds, lower the interval, require fresh introspection for future high-risk mutations, or add a narrowly scoped back-channel revocation signal.
- Preserve fail-closed behavior when validation is due and unavailable.

Required regression test:

- With deterministic time, prove logout/suspension is enforced no later than the accepted bound.
- Race introspection against revocation and prove the bound still holds.

Recommended implementation model: Terra. Request Sol review if event-driven revocation changes the architecture.

## Defense in Depth

### Priority P2 - Use browser-enforced host cookie names

Priority: P2

Finding ID: `SOL-AUTH-004`

Repository: Both

Files likely affected:

- `D:\Side Hustle Arena\src\server\auth\cookies.ts`
- `D:\Sekolah Karir Workspace\src\lib\auth.ts`
- Browser integration configuration/tests

Minimal change:

- Adopt `__Host-` production cookie names with Secure, Path `/`, and no Domain.
- Coordinate the Canonical cookie rename and logout transition; never widen to `.sekolahkarir.id`.
- Confirm sibling-subdomain ownership and parent-domain cookie policy.

Required regression test:

- Attempt duplicate parent-domain session/state cookies and prove they cannot shadow the production host cookie.

Recommended implementation model: Terra.

### Priority P2 - Add Canonical logout Origin validation

Priority: P2

Finding ID: `SOL-AUTH-005`

Repository: Canonical

Files likely affected:

- `D:\Sekolah Karir Workspace\src\app\api\auth\logout\route.ts`

Minimal change:

- Require exact same-origin browser logout while preserving POST and idempotency.

Required regression test:

- Reject sibling/cross-origin and missing-Origin logout without deleting session or revoking grants; accept same-origin logout.

Recommended implementation model: Terra.

### Priority P2 - Equalize failed-login bcrypt work

Priority: P2

Finding ID: `SOL-AUTH-006`

Repository: Canonical

Files likely affected:

- `D:\Sekolah Karir Workspace\src\app\api\auth\login\route.ts`

Minimal change:

- Compare once against the real hash when present or the dummy hash otherwise; return one uniform failure shape.

Required regression test:

- Known-user and unknown-user failures each call bcrypt once and expose the same response contract.

Recommended implementation model: Terra.

### Priority P2 - Enforce production HTTPS/host configuration

Priority: P2

Finding ID: `SOL-AUTH-007`

Repository: Both

Files likely affected:

- `D:\Side Hustle Arena\src\server\auth\config.ts`
- Canonical startup/config validation around `APP_URL` and Arena redirect allowlist

Minimal change:

- Reject non-HTTPS or unexpected production origins and callback URIs.
- Keep explicitly approved localhost HTTP only for development.
- Reject credentials, fragments, and unintended paths in service origins.

Required regression test:

- Production config rejects HTTP, wrong hosts, URL credentials/fragments, and callback mismatch; approved HTTPS configuration passes.

Recommended implementation model: Terra.

### Priority P3 - Add bounded auth-record retention

Priority: P3

Finding ID: `SOL-AUTH-008`

Repository: Both

Files likely affected:

- Canonical SSO retention service/job boundary
- Arena session retention service/job boundary
- Operational monitoring documentation

Minimal change:

- Define and implement idempotent retention for expired/consumed/revoked codes, grants, and sessions.
- Add active-session limits only if product/session requirements approve them.

Required regression test:

- Cleanup removes only records older than policy and preserves every active record.

Recommended implementation model: Terra.

## Future Phase Items

### DB-backed auth route and concurrency tests

Finding ID: `SOL-AUTH-009`

Priority: P1 before production

Repository: Both

Files likely affected: new isolated integration-test harness/files only, plus test configuration.

Minimal change: exercise real PostgreSQL transactions and Next route handlers for one-time consume, JIT races, logout/revoke races, expiry, fail-closed introspection, and error response behavior.

Required regression test: the full race matrix A-H in `AUTH_SECURITY_AUDIT_SOL.md`.

Recommended implementation model: Terra.

### Browser cookie/redirect integration tests

Finding ID: `SOL-AUTH-001`, `SOL-AUTH-004`, `SOL-AUTH-005`, `SOL-AUTH-009`

Priority: P1 before production

Repository: Both

Files likely affected: browser test harness/configuration and test files.

Minimal change: verify real browser handling of host-only/Secure/SameSite/`__Host-` cookies, state, callback URL cleanup, login/logout CSRF, direct nested `/app` navigation, and duplicate-cookie behavior.

Required regression test: the concrete browser cases named in each finding.

Recommended implementation model: Terra.

### Canonical combined migration review

Finding ID: `SOL-AUTH-010`

Priority: P1 before migration application

Repository: Canonical

Files likely affected: migration plan/history only unless a separately authorized split is chosen.

Minimal change: explicitly approve the full `0011_cultured_lilandra.sql` scope or safely regenerate/split it under repository-native migration rules.

Required regression test: apply to a disposable isolated database and compare the resulting schema to the committed Drizzle schema.

Recommended implementation model: Terra.

### Future IDOR enforcement

Priority: P1 for every business API phase

Finding ID: `FUTURE-IDOR-001`

Repository: Arena

Files likely affected: future project, enrollment, workspace, submission, review, reward, leaderboard, and profile service/routes.

Minimal change: derive `currentUser.id` only from the server session and include it in each ownership query predicate. Never accept client `userId` as authorization identity.

Required regression test: authenticated user A cannot read or mutate user B's object by changing object ID, body/query user ID, localStorage, or DemoProvider state.

Recommended implementation model: Terra, followed by Sol authorization review.

### Arena admin role mapping

Priority: future authorization phase

Finding ID: `FUTURE-AUTHZ-001`

Repository: Arena / Canonical contract

Files likely affected: future Arena authorization policy only.

Minimal change: define an explicit Arena-specific admin claim/policy. Do not infer admin from Workspace `founder`, `admin_ops`, or other role strings.

Required regression test: every unrecognized or ordinary Canonical role receives no Arena admin permission.

Recommended implementation model: Terra, followed by Sol review.
