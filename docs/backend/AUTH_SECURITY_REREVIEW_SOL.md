# Arena Authentication — Targeted Sol Security Re-Review

## 1. Review Scope

This was a targeted, read-only re-review of the Phase 2D authentication hardening at Arena `1ea722c` and Canonical `21ff365`. It rechecked the eight original Sol findings, related regression controls, committed migrations, configuration boundaries, retention logic, and existing tests. It was not a new full-repository audit. No source, schema, package, migration, database, runtime service, or Canonical file was changed.

## 2. Review Baselines

- Arena: branch `feature/arena-auth-hardening`, commit `1ea722c` (`fix: harden Arena authentication`).
- Canonical: branch `feature/arena-sso-hardening`, commit `21ff365` (`fix: harden Arena SSO security`).
- Arena's pre-existing untracked `.gitattributes`, `docs/UI mockups request/`, and `graphify-out/` remained excluded.
- Canonical began clean.

## 3. Original Findings Status

| Finding | Original Severity | Phase 2D Claim | Re-Review Status | Production Blocker | Development DB Blocker |
|---|---|---|---|---|---|
| `SOL-AUTH-001` login CSRF/session swapping | Medium | Resolved | VERIFIED RESOLVED | No | No |
| `SOL-AUTH-002` authentication abuse throttling | Medium | Open | OPEN - REQUIRED BEFORE PRODUCTION | Yes | No |
| `SOL-AUTH-003` revocation/suspension window | Medium | Resolved | VERIFIED RESOLVED | No | No |
| `SOL-AUTH-004` browser-enforced host cookie names | Low | Open | OPEN - LOW / DEFENSE IN DEPTH | No | No |
| `SOL-AUTH-005` logout CSRF | Low | Resolved | VERIFIED RESOLVED | No | No |
| `SOL-AUTH-006` failed-login timing | Low | Resolved | VERIFIED RESOLVED | No | No |
| `SOL-AUTH-007` production HTTPS/origin configuration | Low | Resolved | VERIFIED RESOLVED | No | No |
| `SOL-AUTH-008` bounded auth-record retention | Low | Partial | PARTIAL - CLEANUP IMPLEMENTED, SCHEDULER PENDING | Yes | No |

No new Critical or High vulnerability was found.

## 4. Canonical Login CSRF Re-Review

The login flow now issues a 256-bit random CSRF token through `src/app/api/auth/login-flow/route.ts`. The browser receives the same value in a short-lived, host-only, HttpOnly, SameSite=Lax cookie and in a no-store JSON response. The login page keeps the response token in React state and submits it in the custom `x-skw-login-csrf` header.

`src/app/api/auth/login/route.ts` rejects a request before cookie or database mutation unless its Origin exactly equals the configured Canonical origin, its content type is JSON, and the header token timing-safely matches the browser-bound cookie. Missing, malformed, and mismatched tokens fail. Authentication failures retain one generic response shape.

The Canonical project has no broad or dynamic CORS response configuration. Consequently, an untrusted cross-origin page cannot read the login-flow token, and the custom-header credential request requires a preflight for which Canonical grants no cross-origin permission. The defense does not rely on SameSite alone.

Residual risk is limited to the already documented sibling-domain cookie-shadowing condition and same-browser multi-tab invalidation, which can cause denial of an older login attempt but does not provide session swapping.

Verdict: `SOL-AUTH-001` is VERIFIED RESOLVED.

## 5. Continuation Binding Re-Review

Arena continuation is accepted only when it is a safe Canonical-local Arena authorize path. External, protocol-relative, malformed, and non-authorize paths are rejected. A validated continuation is stored separately in a short-lived, host-only, HttpOnly cookie; the credential POST cannot supply or replace it. Successful login consumes the browser-bound continuation and clears the login-flow cookies. Missing or expired continuation safely falls back to the Canonical workspace.

A later login-flow request atomically replaces both continuation and CSRF cookies. An older tab then fails its CSRF check rather than authenticating with the newer continuation. Arena's independent state and PKCE checks remain required before a callback can create an Arena session.

## 6. Logout CSRF Re-Review

Canonical logout remains POST-only and requires the exact configured Canonical Origin before reading the session cookie or mutating grants and sessions. Missing and foreign Origin values are rejected with no revocation or cookie deletion; the exact same-origin request is accepted. Source-session deletion and linked SSO grant revocation remain intact.

Verdict: `SOL-AUTH-005` is VERIFIED RESOLVED.

## 7. Revocation Window Re-Review

Arena's canonical introspection interval now defaults to 60 seconds and is constrained to 30-300 seconds. Revalidation runs when a protected server-side user lookup is due, not on static assets or unrelated request paths. Inactive grants, subject/client mismatches, expired grants, or an unavailable Canonical introspection service revoke or reject the local session once validation is due. Arena session expiry remains bounded by Canonical grant expiry.

Verdict: `SOL-AUTH-003` is VERIFIED RESOLVED. The accepted stale-access bound is at most the configured 30-300-second interval, 60 seconds by default.

## 8. Login Timing Re-Review

Canonical failed login performs exactly one bcrypt comparison: against the stored user hash when a user exists, or against a fixed precomputed dummy hash when no user exists. Both paths then use the same generic unauthorized response. The dummy value is a valid 60-character bcrypt hash at cost 12; a local comparison probe returned false, confirming it is usable work material rather than a valid credential for the tested password.

Verdict: `SOL-AUTH-006` is VERIFIED RESOLVED. A route-level spy test proving exactly one bcrypt call per branch would improve regression coverage but is not required to establish the source-level fix.

## 9. Production HTTPS Re-Review

Arena and Canonical configuration parsers reject credentials, queries, fragments, and unintended paths in service origins. Production requires HTTPS. Arena production origin and allowed origin are fixed to `https://arena.sekolahkarir.id`; the production callback is exactly its `/auth/callback` path. Development HTTP is limited to localhost, `127.0.0.1`, or `[::1]`. Client secrets remain server-only and are not exposed through `NEXT_PUBLIC_` configuration.

Verdict: `SOL-AUTH-007` is VERIFIED RESOLVED.

## 10. Retention Re-Review

Canonical cleanup eligibility is explicit and terminal-state aware:

- Authorization codes: expired for more than 24 hours, or consumed for more than 24 hours.
- Grants: expired for more than 30 days, or revoked for more than 30 days.

Arena cleanup removes sessions expired for more than 30 days, or revoked for more than 30 days. Active records are outside these predicates. The cleanup services are idempotent and are not invoked from request paths. No trusted scheduler or operational execution mechanism is committed.

Verdict: `SOL-AUTH-008` is PARTIAL - cleanup implemented, scheduler pending. This does not block an isolated development database bring-up, but scheduled execution is required before production.

## 11. Migration Hygiene Re-Review

Canonical `0010_phase_3_4_proposal_drafts.sql` contains the proposal schema changes. `0011_cultured_lilandra.sql` contains only the SSO authorization-code and grant tables, foreign keys, and indexes; it has no proposal DDL, drop, rename, or unrelated alteration. Journal order is sequential, and the `0011` snapshot represents the resulting proposal-plus-SSO schema without duplicated SQL objects.

Arena's `0001_pink_khan.sql` remains aligned with the identity session schema and follows `0000_previous_thing.sql`. Required expiry/grant lookup indexes remain present. No Phase 2D schema drift was introduced.

Migration hygiene verdict: VERIFIED / READY for a fresh isolated development database. No migration was applied during this review.

## 12. Regression Assessment

The following controls remain present and were not weakened:

- Authorization codes are random, hashed at rest, expire after 60 seconds, and are transactionally consumed once.
- PKCE S256, exact redirect URI validation, and Arena state validation remain mandatory.
- The raw Canonical session never crosses to Arena.
- Canonical `skw_session` and Arena session/temporary cookies remain host-only because no Domain attribute is set.
- Arena stores only an opaque session-token hash, protects `/app` server-side, and does not trust DemoProvider or client-supplied user identifiers for authentication.
- Canonical authorize, exchange, introspection, and revoke continue to validate active users, live source sessions, client identity, grant expiry, and grant revocation.
- No raw authorization code, PKCE verifier, raw session token, Canonical session cookie, or client secret is intentionally logged.

The previously completed quality gates remain the execution evidence for this source-read-only review: Arena auth tests passed 7/7 and Canonical tests passed 15/15 at the frozen Phase 2D commits. The committed tests directly cover state/return-path/PKCE/session/config/retention helpers in Arena and CSRF/origin/content-type/continuation/cookie/SSO/retention helpers in Canonical.

Coverage is adequate for the targeted static re-review, but it is not browser or database end-to-end coverage. Missing and wrong CSRF behavior follows the tested matching helper, while the route suite does not independently exercise every missing-token, logout-Origin, and bcrypt-call-count branch. Database cleanup predicates, transactional code-consume races, JIT races, grant-revocation races, and real browser cookie/CORS behavior remain explicit Phase 2E/pre-production integration-test work.

## 13. Remaining Open Risk

- `SOL-AUTH-002` remains Medium and open. There is no shared distributed limiter for password login, authorize, token exchange, Arena login initiation, Arena callback churn, introspection, or revoke. It is required before production but does not block controlled isolated development DB testing.
- `SOL-AUTH-004` remains Low and open as defense in depth. Existing cookies are correctly host-only, HttpOnly, SameSite=Lax, Path=/, and Secure on HTTPS, but do not use browser-enforced `__Host-` names. Any rename requires coordinated production transition and sibling-domain policy review.
- `SOL-AUTH-008` remains Low and partial until a trusted scheduler invokes the implemented cleanup services.

## 14. Development Database Bring-Up Gate

READY FOR PHASE 2E DEVELOPMENT DATABASE BRING-UP.

The targeted source review found zero Critical and zero High issues; the remaining Medium item is production-only hardening. Migration hygiene is verified. Phase 2E must use a fresh isolated non-production database, apply only the reviewed migration chains, and perform the planned DB-backed auth/concurrency tests. This review did not authorize or perform database access or migration application.

## 15. Remaining Production Preconditions

- Add shared distributed rate limiting with account/IP-safe behavior and observable 429 handling for public authentication flow endpoints, plus conservative service-level limits for protected SSO endpoints.
- Run DB-backed route and concurrency tests for one-time code consume, JIT races, logout/revoke races, expiry, and fail-closed introspection.
- Run real-browser tests for cookie scope, login/logout CSRF, state/PKCE redirects, duplicate-cookie behavior, and nested `/app` protection.
- Schedule and monitor the implemented retention cleanup through a trusted production job boundary.
- Validate actual production TLS, exact origins/callbacks, environment configuration, and secret provisioning before deployment.
- Resolve or formally accept the Low `__Host-` cookie-name defense-in-depth risk during production readiness review.

## 16. Security Gate

Security gate: PASS WITH DEFERRED PRODUCTION HARDENING.

- Critical remaining: 0.
- High remaining: 0.
- Medium remaining: 1.
- Low remaining: 2 (`SOL-AUTH-004` open; `SOL-AUTH-008` partial).
- Development DB gate: READY.
- Production auth gate: NOT YET READY.
