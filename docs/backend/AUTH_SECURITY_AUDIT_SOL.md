# Side Hustle Arena - Sol Auth Security Audit

## 1. Executive Summary

Sol reviewed the first-party Sekolah Karir Workspace to Arena authorization-code and PKCE bridge at the frozen commits below. The source implements the core security model correctly: high-entropy authorization codes and sessions, SHA-256 hashes at rest, PKCE S256, state validation, exact callback matching, transactional one-time code consumption, host-only cookies, server-side identity mapping, local session expiry bounded by the canonical grant, periodic grant introspection, and a server-side `/app` guard.

No Critical or High vulnerability was confirmed. Three Medium findings require targeted hardening before production: Canonical login CSRF/session swapping, missing authentication abuse throttling, and the intentional maximum 300-second revocation/suspension cache window. Five Low findings cover cookie-shadowing defense, Canonical logout CSRF, login timing leakage, production HTTPS configuration enforcement, and persistent auth-record retention. Two Informational findings record the current test-depth and migration-scope limitations.

Security gate: **PASS WITH REMEDIATIONS**. There is no Critical/High blocker to an isolated database-backed integration test. Production deployment remains blocked on the Medium remediations, browser/DB-backed integration tests, migration review/application authorization, secret provisioning, TLS/origin validation, and operational monitoring.

No source patch was applied. Review every remediation before implementation; source code remains unchanged.

## 2. Review Baselines

Arena commit: `09cc39d` (`feat: add Arena authentication bridge`)

Canonical commit: `98c325e` (`feat: add Arena SSO bridge`)

Arena branch: `feature/arena-auth-bridge`

Canonical branch: `feature/arena-sso-bridge`

Baseline integrity was verified before review. Arena contained only the approved pre-existing untracked paths `.gitattributes`, `docs/UI mockups request/`, and `graphify-out/`. Canonical was clean. Neither migration has been applied and no deployment or runtime database integration was performed.

## 3. Architecture Reviewed

1. Arena `GET /auth/login` creates state and a PKCE verifier, stores both in short-lived HttpOnly cookies, sanitizes `returnTo`, and redirects to Canonical.
2. Canonical `GET /api/sso/arena/authorize` validates the exact client/callback/S256 request and current `skw_session`, then stores a 60-second authorization-code hash tied to the canonical user, source session, client, redirect URI, and PKCE challenge.
3. Arena receives raw code and state at `/auth/callback`, validates state, and exchanges the code plus verifier server-to-server using the shared client secret.
4. Canonical consumes the code transactionally under a row lock and creates a grant bounded by the source session expiry.
5. Arena validates the Canonical response with Zod, upserts `identity.users` by canonical UUID subject, creates a random opaque local session, stores only its SHA-256 hash, and sets `arena_session`.
6. Arena `/app/*` resolves the server session. Canonical grant introspection runs at most every configured interval, default 300 seconds; a due check that fails revokes the local session and fails closed.
7. Arena logout revokes the local session and best-effort revokes its Canonical grant. Canonical logout revokes grants tied to the source session and deletes that session.

## 4. Threat Model

Reviewed actors:

- Legitimate browser user.
- Unauthenticated attacker and attacker-controlled website.
- Malicious authenticated Workspace or Arena user.
- Attacker with a stolen code, grant ID, Arena cookie, Canonical cookie, or service secret.
- Replay and concurrent-request attacker.
- Attacker attempting login CSRF or session fixation.
- Compromised browser/client-side JavaScript.
- Compromised or misconfigured Arena/Canonical service.
- Suspended Canonical or Arena user.
- Conditionally, an attacker controlling a sibling `*.sekolahkarir.id` host.

Primary assets are Canonical identity, Canonical session, Arena identity mapping, authorization codes, PKCE verifier, SSO grants, Arena sessions, and the server-to-server client secret.

## 5. Trust Boundaries

| Boundary | Credentials or sensitive values crossing it |
|---|---|
| Browser -> Arena | `arena_session`; temporary state, verifier, and return cookies; callback code/state in the URL |
| Arena -> Browser | Redirects; host-only HttpOnly cookies; no client secret or Canonical cookie |
| Browser -> Canonical | Host-only `skw_session`; authorize client ID, exact redirect URI, state, S256 challenge; login credentials only on Canonical |
| Canonical -> Browser | One-time code and echoed state redirected to Arena |
| Arena -> Canonical | Bearer client secret; code, verifier, client ID, exact redirect URI; grant ID for introspect/revoke |
| Canonical -> Arena | Validated subject UUID, grant UUID/expiry, active status, and display-only profile fields |
| Arena -> Arena DB | Session token hash, grant ID, expiry/revocation timestamps, immutable subject mapping, profile caches |
| Canonical -> Canonical DB | Canonical opaque session ID, authorization-code hash, PKCE challenge, grant, expiry/revocation state |

The raw `skw_session` never crosses into Arena. The raw Arena session token is never persisted by Arena.

## 6. Positive Security Controls

- CSPRNG uses 32 random bytes for codes, state, verifier, and Arena sessions.
- Authorization code and Arena bearer token are SHA-256 hashed before persistence.
- Authorization-code TTL is 60 seconds and enforced server-side with strict expiry comparison.
- Code consumption uses a database transaction, `FOR UPDATE`, and a conditional `consumed_at IS NULL` update.
- Code is bound to client ID, exact redirect URI, S256 challenge, user, and source session.
- Only PKCE `S256` is accepted; missing/malformed/wrong verifiers are rejected.
- State is unpredictable, browser-bound in an HttpOnly cookie, timing-safely compared, and cleared after callback.
- Arena return paths are restricted to `/app` and `/app/*`; external, protocol-relative, encoded, backslash, JavaScript, data, and control-character probes were rejected.
- Canonical redirect validation uses exact allowlist membership, not suffix, substring, or wildcard matching.
- `skw_session`, `arena_session`, and temporary Arena cookies have no `Domain` attribute.
- Arena sessions expire no later than the Canonical grant and reject revoked, expired, or Arena-suspended users.
- Canonical authorize, exchange, and introspection consistently require an ACTIVE Canonical user and live source session.
- Canonical token, introspection, and revoke endpoints require the server-side shared secret with timing-safe comparison.
- Canonical requests have a five-second abort timeout and `cache: "no-store"` on the Arena backchannel.
- Canonical responses are parsed with Zod before use by Arena.
- `/app` and every nested route in the `(app)` route group are guarded server-side by `requireCurrentUser()`.
- DemoProvider remains UI/demo state only and is not an authentication authority.
- No Workspace role is mapped to Arena administration.
- No auth-relevant dependency vulnerability was reported by `npm audit --omit=dev` in either frozen tree.
- No Phase 2B secret literal, `NEXT_PUBLIC` client secret, or intentional raw credential logging was found.

## 7. Findings Summary

| ID | Severity | Repository | Title | Production Blocker? |
|---|---|---|---|---|
| SOL-AUTH-001 | MEDIUM | Canonical / Both | Canonical login permits login CSRF and downstream Arena session swapping | Yes |
| SOL-AUTH-002 | MEDIUM | Canonical / Both | Authentication endpoints lack abuse throttling | Yes |
| SOL-AUTH-003 | MEDIUM | Both | Revocation and suspension can remain cached for up to 300 seconds | Yes - accept or reduce explicitly |
| SOL-AUTH-004 | LOW | Both | Cookie names lack `__Host-` shadowing protection | Conditional / defense in depth |
| SOL-AUTH-005 | LOW | Canonical | Canonical logout has no Origin validation | No |
| SOL-AUTH-006 | LOW | Canonical | Login timing equalization performs different bcrypt work | No |
| SOL-AUTH-007 | LOW | Both | Production HTTPS requirements are configuration-derived, not enforced | No |
| SOL-AUTH-008 | LOW | Both | Expired codes, grants, and sessions have no bounded retention path | No |
| SOL-AUTH-009 | INFORMATIONAL | Both | Auth tests are helper-level and do not exercise routes or databases | No |
| SOL-AUTH-010 | INFORMATIONAL | Canonical | Canonical auth migration also contains unrelated proposal schema | No |

Counts: Critical 0; High 0; Medium 3; Low 5; Informational 2.

## 8. Critical Findings

NONE.

## 9. High Findings

NONE.

## 10. Medium Findings

### [SOL-AUTH-001] Canonical login permits login CSRF and downstream Arena session swapping

Severity:
MEDIUM

Repository:
Canonical / Both

Confidence:
High

Evidence:
`D:\Sekolah Karir Workspace\src\app\api\auth\login\route.ts`, `POST()` lines 18-26 and 72-86, parses any body accepted by `request.json()`, creates a fresh Canonical session, and sets `skw_session` without checking `Origin`, `Referer`, fetch metadata, a CSRF token, or an enforced JSON/custom-header boundary. `D:\Sekolah Karir Workspace\src\app\login\page.tsx`, `submit()` lines 23-37, uses same-origin JSON, but the server does not require that calling shape. `D:\Sekolah Karir Workspace\src\app\api\sso\arena\authorize\route.ts` lines 26-45 trusts whichever valid Canonical session is then present.

Attack Scenario:
An attacker-controlled same-site sibling sends a credentialed, CORS-safelisted `text/plain` POST containing the attacker's own valid Canonical credentials. The endpoint parses the JSON body and returns `Set-Cookie`; browser Fetch processing respects that cookie even when CORS prevents the attacker from reading the response. The victim is now logged into the attacker's Canonical account. When the victim later starts Arena login, Canonical authorizes the attacker subject and Arena creates an attacker-owned local session in the victim browser. A generic cross-site attacker may be limited by third-party-cookie policy, but a sibling host is same-site and avoids that mitigation. This is login CSRF/session swapping, not takeover of the victim's Canonical account.

Impact:
Victim activity can be attributed to and stored under the attacker's identity. Once Arena business mutations exist, submissions or other user data could be placed into an account the attacker controls. Current Arena business APIs are not implemented, which bounds immediate Arena impact.

Likelihood:
Medium

Recommended Fix:
Require exact Canonical-origin validation for login, reject missing/mismatched origin for browser requests, and require the intended `application/json` plus a same-origin-only custom header or login CSRF token. Preserve generic authentication errors. Treat SameSite as defense in depth.

Regression Test:
An integration test must submit attacker credentials with `Origin: https://untrusted.example`, with a sibling origin, with missing Origin, and with `Content-Type: text/plain`; all must be rejected and must not emit `skw_session`. The legitimate Canonical login page request must still succeed.

### [SOL-AUTH-002] Authentication endpoints lack abuse throttling

Severity:
MEDIUM

Repository:
Canonical / Both

Confidence:
High

Evidence:
`D:\Sekolah Karir Workspace\src\app\api\auth\login\route.ts` performs bcrypt verification with cost 12 through `src/lib/auth.ts` but has no per-IP, per-account, or global attempt control. Targeted searches found no auth rate-limit middleware in either repository. `D:\Sekolah Karir Workspace\src\app\api\sso\arena\authorize\route.ts` inserts an authorization-code row for every valid request; Arena `/auth/login` and `/auth/callback` also have no abuse controls. Token/introspection/revoke are protected by the high-entropy client secret, so they are lower-priority throttling surfaces.

Attack Scenario:
An unauthenticated attacker repeatedly submits password guesses or CPU-expensive failures to Canonical login. A malicious authenticated user can also churn authorize/callback flows, creating persistent code, grant, and Arena session rows.

Impact:
Online credential guessing, account-targeted abuse, bcrypt CPU exhaustion, and database/index growth.

Likelihood:
High for automated probing; exploit success depends on password quality and deployment capacity.

Recommended Fix:
Add bounded, observable throttling at Canonical login first, then at authorize and Arena login/callback. Use IP plus normalized account dimensions without revealing account existence. Add conservative body-size/request limits and operational alerts. Redis is not required by this audit; select the production-native limiter later.

Regression Test:
Issue requests through the deployed limiter boundary and verify the configured threshold returns 429 with the same behavior for known and unknown accounts, recovers after the window, and does not expose whether an email exists.

### [SOL-AUTH-003] Revocation and suspension can remain cached for up to 300 seconds

Severity:
MEDIUM

Repository:
Both

Confidence:
High

Evidence:
`D:\Side Hustle Arena\src\server\auth\session.ts`, `getCurrentUser()` lines 39-49, skips Canonical introspection until `lastCanonicalCheckAt + interval`; `src/server/auth/config.ts` line 9 defaults that interval to 300 seconds. Canonical introspection correctly rejects revoked/expired grants and inactive users in `D:\Sekolah Karir Workspace\src\app\api\sso\arena\introspect\route.ts` lines 19-30, but Arena does not observe that state between checks. Revocation racing with an introspection that just returned active can begin a fresh cache interval.

Attack Scenario:
An attacker steals `arena_session`. The legitimate user logs out of Canonical or is suspended immediately after the attacker's Arena session passed introspection. The stolen Arena session can remain accepted until the next due check, bounded by approximately 300 seconds plus an in-flight request/network duration.

Impact:
Bounded residual access after a security-sensitive revocation event.

Likelihood:
Medium after session theft; low without a stolen session.

Recommended Fix:
Obtain explicit risk acceptance for the 300-second bound or reduce it for protected operations. For higher-risk future mutations, require fresh Canonical validation or implement a back-channel revocation signal. Keep the current fail-closed behavior when a due check cannot complete.

Regression Test:
With a deterministic clock and DB-backed sessions, introspect active, revoke/suspend Canonical state, advance just below and then to the configured interval, and prove access is rejected no later than the documented bound. Add a revocation-vs-introspection race test.

## 11. Low Findings

### [SOL-AUTH-004] Cookie names lack `__Host-` shadowing protection

Severity:
LOW

Repository:
Both

Confidence:
Medium - exploitability depends on sibling-domain control and cookie parsing order.

Status:
NEEDS CONFIRMATION - confirm sibling-host trust and production duplicate-cookie selection before treating this as exploitable in the deployed environment.

Evidence:
`D:\Side Hustle Arena\src\server\auth\cookies.ts` lines 5-8 names the Arena session and flow cookies without the `__Host-` prefix. `D:\Sekolah Karir Workspace\src\lib\auth.ts` line 12 does the same for `skw_session`. Their setters correctly omit `Domain`, but an untrusted sibling can still attempt to set a broader `Domain=sekolahkarir.id` cookie with the same name.

Attack Scenario:
If an attacker controls a sibling host, they set parent-domain cookies carrying attacker-known flow values or their own session token, then direct a victim to Arena/Canonical. Where the server cookie parser selects the injected duplicate, this can produce login/session swapping. This requires confirming sibling-host trust and production cookie-selection behavior.

Impact:
Conditional cross-account session fixation or denial of authentication.

Likelihood:
Low

Recommended Fix:
Use `__Host-` production cookie names, which require Secure, Path `/`, and no Domain. Plan Canonical cookie renaming as a coordinated migration; do not widen its Domain. Confirm every sibling subdomain is governed and cannot set parent-domain cookies.

Regression Test:
In a browser integration environment, pre-set a same-name parent-domain cookie, then prove the production `__Host-` session and temporary cookies cannot be shadowed and the injected flow is rejected.

### [SOL-AUTH-005] Canonical logout has no Origin validation

Severity:
LOW

Repository:
Canonical

Confidence:
High

Evidence:
`D:\Sekolah Karir Workspace\src\app\api\auth\logout\route.ts`, `POST()` lines 13-33, performs grant revocation and session deletion without checking Origin. SameSite=Lax blocks ordinary cross-site subresource POST cookies, but a sibling origin is same-site.

Attack Scenario:
A malicious sibling page submits POST to Canonical logout. The browser sends the host cookie to Canonical, the source session is deleted, and linked Arena grants are revoked.

Impact:
Forced logout and availability disruption only; no account takeover.

Likelihood:
Low

Recommended Fix:
Require an exact Canonical Origin (or a standard CSRF token) on logout and keep POST semantics.

Regression Test:
Cross-origin and missing-Origin logout requests must return 403 without deleting the Canonical session or revoking grants; the legitimate same-origin request must remain idempotent.

### [SOL-AUTH-006] Login timing equalization performs different bcrypt work

Severity:
LOW

Repository:
Canonical

Confidence:
High

Evidence:
`D:\Sekolah Karir Workspace\src\app\api\auth\login\route.ts` line 38 compares the supplied password for an existing user, then lines 39-41 run a second dummy comparison for every failure. Unknown users skip the first comparison in `verifyPassword()` and perform only the dummy comparison. Existing-user failures therefore perform roughly twice the bcrypt work.

Attack Scenario:
An attacker samples repeated login latency for candidate emails and distinguishes one-cost from two-cost failures. Missing throttling increases sample quality and CPU impact.

Impact:
Probabilistic account enumeration and amplified denial-of-service cost for known accounts.

Likelihood:
Medium

Recommended Fix:
Perform exactly one bcrypt comparison using either the real hash or the dummy hash, then apply a uniform failure response.

Regression Test:
Mock/spy the bcrypt comparator and prove known-user and unknown-user failures each invoke it exactly once and return the same status/body shape.

### [SOL-AUTH-007] Production HTTPS requirements are configuration-derived, not enforced

Severity:
LOW

Repository:
Both

Confidence:
High

Evidence:
`D:\Side Hustle Arena\src\server\auth\config.ts` accepts any Zod-valid URL for Arena and Canonical origins. `src/server/auth/cookies.ts` lines 11-16 enables Secure only when the configured Arena URL is HTTPS, while `src/server/auth/sso-client.ts` lines 17-25 sends the client secret to the configured Canonical URL. Canonical `src/lib/auth.ts` lines 64-68 similarly derives Secure from `APP_URL`.

Attack Scenario:
A production misconfiguration uses HTTP or an unintended host. Cookies can lose Secure and the server-to-server secret can be transmitted to the wrong destination.

Impact:
Credential disclosure or session exposure caused by deployment misconfiguration, not user input.

Likelihood:
Low

Recommended Fix:
Fail startup/deployment validation when production Arena, Canonical, callback, or allowed origins are not exact approved HTTPS origins. Keep explicitly approved localhost HTTP only in development.

Regression Test:
Production-mode config tests must reject HTTP, credentials-in-URL, fragments, unexpected hosts, and callback/origin mismatches while permitting the approved HTTPS hosts.

### [SOL-AUTH-008] Expired codes, grants, and sessions have no bounded retention path

Severity:
LOW

Repository:
Both

Confidence:
High

Evidence:
Canonical schema/migration persist consumed/expired authorization codes and expired/revoked grants. Arena schema/migration persist expired/revoked sessions. No cleanup query, retention job, or per-user session cap exists in the reviewed auth source.

Attack Scenario:
A malicious authenticated user repeatedly completes login flows. Each flow creates durable code, grant, and session records, causing table and index growth over time.

Impact:
Operational storage/maintenance pressure and a larger historical metadata footprint; not direct authentication bypass.

Likelihood:
Medium over a long-running deployment.

Recommended Fix:
Define retention periods and an idempotent cleanup mechanism for expired/consumed/revoked auth rows, plus monitoring and reasonable active-session limits. Preserve records only as long as audit policy requires.

Regression Test:
Seed active and retention-expired records, run cleanup, and prove only old terminal records are removed while active codes, grants, and sessions remain usable.

## 12. Informational Findings

### [SOL-AUTH-009] Auth tests are helper-level and do not exercise routes or databases

Severity:
INFORMATIONAL

Repository:
Both

Confidence:
High

Evidence:
Arena `scripts/auth-security.test.mjs` contains five pure/helper checks. Canonical `src/lib/sso/arena.test.ts` contains seven pure/helper checks. Both suites passed during this audit, but neither starts Next route handlers nor uses PostgreSQL transactions, cookies, concurrent requests, or a browser.

Attack Scenario:
A future regression breaks route wiring, transaction behavior, or browser cookie semantics while helper tests remain green.

Impact:
Reduced assurance, not a presently demonstrated vulnerability.

Likelihood:
Medium

Recommended Fix:
Add isolated DB-backed route tests and browser integration tests before production, including the race and CSRF cases in this report.

Regression Test:
The remediation is the route/DB/browser suite described in Section 23.

### [SOL-AUTH-010] Canonical auth migration also contains unrelated proposal schema

Severity:
INFORMATIONAL

Repository:
Canonical

Confidence:
High

Evidence:
`D:\Sekolah Karir Workspace\drizzle\0011_cultured_lilandra.sql` lines 1-21 and 48-59 create/relate `proposal_drafts` in addition to the SSO tables at lines 23-46 and 53-64. The SSO table SQL matches the current schema, but migration application would also deploy the unrelated proposal schema.

Attack Scenario:
An operator assumes the migration is auth-only and applies a broader schema change without reviewing the proposal portion.

Impact:
Deployment coupling and rollback/review complexity; no direct auth vulnerability was found.

Likelihood:
Medium if the migration is applied without an explicit full-file review.

Recommended Fix:
Treat the migration as a combined migration in the deployment plan or regenerate/split it only in an authorized remediation phase after confirming Drizzle history constraints. Do not apply it as an assumed auth-only migration.

Regression Test:
Run the repository-native migration/schema consistency check against an isolated disposable database and assert the expected complete table set before production approval.

## 13. Authorization Code / PKCE Assessment

Authorization codes use 32-byte CSPRNG output, are stored only as SHA-256 hashes, expire after 60 seconds, and are bound to canonical user, source session, client, exact redirect, and S256 challenge. Exchange holds a row lock in a transaction, rechecks expiry/consumption/bindings/status/source-session expiry, conditionally updates only an unconsumed code, and creates the grant in the same transaction. Concurrent exchanges of the same code cannot both succeed.

PKCE verifier generation is 32-byte CSPRNG, retained in a short-lived HttpOnly Arena cookie, and exchanged only server-to-server. Canonical accepts only S256 and timing-safely compares the derived challenge. Code-only theft is insufficient; even code plus verifier still requires the server client secret for direct exchange or a valid browser state flow through Arena.

Replay resistance: **STRONG for the implemented static/transaction model; DB-backed concurrency proof remains a required integration test.**

## 14. Session Security Assessment

Arena always generates a fresh opaque 256-bit token after successful exchange; no pre-auth session ID is adopted and the database UUID is not a bearer credential. Only the token hash is stored. Lookup requires matching hash, unrevoked row, future expiry, ACTIVE Arena user, and due Canonical validation. Database or due-introspection errors do not authenticate the request.

Session fixation resistance is strong against ordinary cross-site attackers. SOL-AUTH-004 records the conditional sibling-domain cookie-shadowing edge case. A stolen `arena_session` is a full Arena bearer credential until local expiry/revocation or the next Canonical validation; it does not reveal a password or Canonical session.

## 15. Cookie Assessment

Canonical `skw_session`: HttpOnly, SameSite=Lax, Secure when configured HTTPS, Path `/`, 14-day MaxAge, no Domain. Host-only status is unchanged.

Arena `arena_session`: HttpOnly, SameSite=Lax, Secure when Arena origin is HTTPS, Path `/`, expiry bounded by grant, no Domain.

Arena state/verifier/return cookies: HttpOnly, SameSite=Lax, Secure when HTTPS, Path `/`, 10-minute TTL, no Domain, cleared after callback.

No cookie value was printed. Cookie names are distinct across products. `__Host-` prefix hardening is covered by SOL-AUTH-004.

## 16. CSRF / Redirect Assessment

Arena callback state blocks missing/wrong-state and ordinary login-CSRF attempts. Arena logout is POST-only and requires an exact configured Origin. Canonical token/introspect/revoke require the service secret, so browser CSRF cannot invoke them. SOL-AUTH-001 and SOL-AUTH-005 cover Canonical login/logout gaps.

Arena return-path probes rejected external, protocol-relative, triple-slash, backslash, encoded/double-encoded external, JavaScript, data, whitespace-prefixed scheme, and control-character inputs. Valid `/app/*` paths and query strings are retained. Canonical callback matching is exact and rejects host-suffix and query-extended variants.

Next.js 16 Route Handlers are not cached by default, and the server backchannel also uses `no-store`. Authorization code presence in a short-lived callback query remains a standard, bounded browser-history/access-log exposure; no application logger records it and successful exchange consumes it immediately.

## 17. Identity / JIT Provisioning Assessment

Canonical `users.id` UUID is the only authoritative subject. Arena validates UUID response fields and upserts on unique `identity.users.auth_subject`; email/name/avatar are cache fields only. The upsert handles simultaneous first login without duplicate identities. It does not change Arena `status`, so a Canonical login cannot reactivate an Arena-suspended user. No auth lookup by email cache was found.

## 18. Revocation / Logout Assessment

Canonical logout updates all grants tied to the source session before deleting that session. Failures before completion fail safe by leaving the request unsuccessful; deletion also causes grant introspection's source-session inner join to fail. Arena logout attempts remote revocation but always proceeds to local revocation when the remote call fails. Repeated revocation is idempotent.

The maximum normal residual Canonical logout/suspension window is the configured Arena introspection interval, default 300 seconds, plus an already-authorized in-flight request. See SOL-AUTH-003.

## 19. Service-to-Service Security Assessment

The client secret appears only in server-only modules/environment names. It is not `NEXT_PUBLIC`, query data, redirect data, browser data, or log data. All three Canonical backchannel endpoints authenticate it using timing-safe comparison. Missing/invalid configuration fails safely. Arena uses a fixed server-configured origin, five-second timeout, JSON POST, and no-store fetch. SOL-AUTH-007 addresses stricter production HTTPS/host validation.

Theft blast radius:

| Stolen item | Practical effect |
|---|---|
| Authorization code only | Cannot exchange without verifier and client secret/state path |
| Code + verifier | Direct exchange still needs client secret; callback still needs valid Arena state |
| Grant ID | Not a bearer credential; introspect/revoke require client secret |
| `arena_session` | Full current Arena identity until expiry/revocation/revalidation |
| Arena client secret | Introspect/revoke known grants and exchange intercepted code+verifier; cannot mint a Canonical session/code alone |
| `skw_session` | Full Canonical session and ability to mint Arena grants for that user until expiry/logout/status rejection |

## 20. Concurrency / Race Assessment

| Race | Classification | Reason |
|---|---|---|
| A. Two exchanges of one code | SAFE | Transactional row lock plus conditional unconsumed update permits one winner |
| B. Two Arena callbacks | SAFE / availability caveat | Same code has one winner; distinct concurrent codes can create same-user sessions but not cross-user identity |
| C. Two first-time JIT provisions | SAFE | Unique subject plus atomic upsert converges on one identity |
| D. Logout vs introspection | ACCEPTABLE WINDOW | A request already validated may complete; future local requests fail after local revoke; remote state is bounded by the interval |
| E. Canonical logout vs code exchange | SAFE | Locked/joined source state and FK delete behavior prevent a live grant from surviving without a live source session |
| F. Grant revocation vs introspection | ACCEPTABLE WINDOW | Introspection can return active adjacent to revocation; Arena may cache that answer up to the configured interval |
| G. Arena session revoke vs protected request | ACCEPTABLE WINDOW | An already-authorized request may complete; subsequent lookups reject `revoked_at` |
| H. Session expiry during introspection | ACCEPTABLE WINDOW | A request can cross expiry during the five-second network bound; no renewal extends persisted expiry |

## 21. Secrets / Logging Assessment

Only environment variable names were inspected. The tracked `.env.example` files contain empty secret placeholders. The Phase 2B commit diffs contain no detected secret literal or `NEXT_PUBLIC` secret name. A historical private-key marker in a QA probe had no private-key body and was not a credential. No auth logger/console path records raw code, verifier, client secret, `skw_session`, `arena_session`, password, password hash, or `DATABASE_URL`.

No secret values were printed during this audit.

## 22. Database / Migration Security Assessment

Arena migration `0001_pink_khan.sql` creates `identity.sessions` with unique non-null token hash, non-null user/grant/expiry, revocation/canonical-check timestamps, user FK, and user/expiry/grant indexes. It has no raw-token column.

Canonical migration `0011_cultured_lilandra.sql` creates unique code hash, user/source-session FKs, bound client/redirect/challenge/method, expiry/consumption timestamps, grant user/source-session relationships, and client/expiry/session indexes. It persists the Canonical source session ID only inside the Canonical database; it is never sent to Arena. Grant deletion behavior supports fail-closed introspection when a source session disappears. SOL-AUTH-010 records the unrelated proposal schema in the same migration.

Generated: YES. Applied: NO. Runtime database behavior: NOT VERIFIED.

## 23. Test Coverage Assessment

Both existing suites were rerun with the correct repository runners: Arena 5/5 passed; Canonical 7/7 passed.

| Security property | Tested | Statically verified | Not covered |
|---|---:|---:|---:|
| CSPRNG/hash helper shape | Arena | Yes | Statistical/production entropy health |
| PKCE known vector/wrong verifier | Both | Yes | Route-level missing/malformed verifier |
| State equality/missing/wrong | Arena helper | Yes | Browser cookie binding and replay |
| Return-path common external inputs | Arena helper + ad hoc probe | Yes | Browser parser matrix |
| Exact Canonical redirect matching | Canonical helper + ad hoc probe | Yes | Deployment allowlist configuration |
| Code expiry/consumed predicate | Canonical helper | Yes | DB clock boundary |
| Transactional single-use code | No | Yes | Real concurrent PostgreSQL exchange |
| Client-secret mismatch | Canonical helper | Yes | Route authentication on all endpoints |
| ACTIVE Canonical status | Canonical helper | Yes | Route flow across authorize/exchange/introspect |
| Arena session expiry <= grant | Arena helper | Yes | DB/cookie expiry integration |
| Raw Arena token hashed at rest | Arena helper | Yes | Actual persisted row inspection |
| JIT unique-race handling | No | Yes | Concurrent DB upsert |
| Arena suspension | No | Yes | DB-backed protected request |
| Canonical logout grant revocation | No | Yes | Transaction/failure injection |
| Arena logout local-first security | No | Yes | Browser Origin and failure injection |
| Due introspection fail closed | No | Yes | Timeout/malformed/DB failure integration |
| `/app/*` server guard | No | Yes | Direct browser navigation matrix |
| Login CSRF defense | No | Finding | Cross/sibling-origin browser test |
| Rate limiting | No | Absent | Deployed limiter tests |
| Race matrix A-H | No | Yes where noted | Deterministic concurrent integration tests |
| Secret/log exposure | No | Static scan | Runtime platform/access-log policy |

## 24. Future IDOR Requirements

No Arena business API currently exposes a demonstrated IDOR. Every future user-scoped operation must derive identity as:

`request -> server Arena session -> identity.users.id -> ownership predicate`

For example:

```sql
WHERE enrollment.id = :id
  AND enrollment.user_id = :current_user_id
```

Never fetch a user-owned row by object ID and then trust `userId` from body, query, localStorage, DemoProvider, or client context. Apply ownership, week, enrollment, and project scope in the database query for read and mutation paths. Arena administration must remain an explicit Arena policy and must not inherit Workspace role strings accidentally.

## 25. Production Preconditions

1. Remediate SOL-AUTH-001 and SOL-AUTH-002.
2. Resolve SOL-AUTH-003 by explicit risk acceptance or a shorter/fresher validation model.
3. Add DB-backed route, browser-cookie, logout, revocation, and concurrency tests.
4. Validate exact production HTTPS origins/callbacks and secret provisioning without printing values.
5. Review the complete Canonical combined migration and Arena migration in an isolated disposable database before authorized application.
6. Define auth-row retention, monitoring, alerting, and incident revocation procedures.
7. Confirm sibling-subdomain governance and cookie-prefix strategy.
8. Keep migrations unapplied and production undeployed until separately authorized.

## 26. Security Gate

**PASS WITH REMEDIATIONS**

No Critical/High issue blocks an isolated database-backed integration test. Medium/Low findings must be addressed or explicitly accepted before production. Recommended next phase: **PHASE 2D - TERRA TARGETED AUTH HARDENING**.
