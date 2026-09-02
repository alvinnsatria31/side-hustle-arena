# Side Hustle Arena — Auth Implementation

## 1. Architecture

Arena redirects to canonical Sekolah Karir auth, receives a one-time code, exchanges it server-to-server with PKCE, then creates its own opaque session.

## 2. Why Shared Parent Cookie Was Rejected

skw_session remains host-only and is never copied, widened, or read by Arena.

## 3. Canonical Identity

Canonical users.id UUID maps to identity.users.auth_subject.

## 4. Authorization Code Flow

Codes are random, SHA-256 hashed at rest, limited to 60 seconds, redirect only to an exact configured URI, and atomically consumed.

## 5. PKCE

Arena sends S256 challenges and canonical exchange verifies the matching verifier. plain is rejected.

## 6. SSO Grant

Canonical grants are revocable, tied to the canonical session, and expire no later than that session.

## 7. Arena Local Session

Arena stores only a SHA-256 token hash and canonical grant ID. The browser holds the random opaque arena_session.

## 8. Cookie Policy

arena_session and temporary state/verifier cookies are HttpOnly, SameSite=Lax, Path /, host-only, and Secure for HTTPS Arena origins.

## 9. JIT Provisioning

Verified subject lookup/upsert updates only non-authoritative display caches.

## 10. Protected Route Boundary

The /app layout calls requireCurrentUser() server-side before mounting the existing client chrome.

## 11. Canonical Revalidation

Sessions introspect grants at a configurable 60-second default (bounded to 30-300 seconds). When revalidation is due and unavailable, Arena revokes the local session and fails closed. The lower default reduces the revocation/suspension stale window while increasing Canonical introspection traffic.

## 12. Logout Model

Arena POST logout validates Origin, best-effort revokes its grant, revokes its local session, and clears its cookie. Canonical logout revokes grants linked to its deleted source session.

## 13. CSRF / Origin Boundary

Browser-authenticated mutation routes use the explicit ARENA_ALLOWED_ORIGINS list; SameSite is defense-in-depth.

## 14. Open Redirect Protection

Only /app and /app/* return paths survive decoding, origin, slash, backslash, and protocol-relative checks.

## 15. Failure Policy

Malformed callbacks, invalid grants, wrong state, expired sessions, and failed required revalidation create no Arena session. Internal errors are not exposed.

## 16. Admin Authorization Status

DEFERRED / NOT YET MAPPED. Workspace roles do not automatically grant Arena administration.

## 17. Environment Variables

DATABASE_URL, ARENA_ORIGIN, SK_AUTH_ORIGIN, ARENA_SSO_CLIENT_ID, ARENA_SSO_CLIENT_SECRET, ARENA_SSO_INTROSPECTION_INTERVAL_SECONDS, ARENA_ALLOWED_ORIGINS.

## 18. Migration Summary

Arena migration 0001_pink_khan.sql creates identity.sessions. Canonical migration 0011_cultured_lilandra.sql creates authorization-code and grant tables. Neither was applied.

## 19. Security Assumptions

The shared client secret is server-only, both origins are correctly configured, and canonical database session/user status remains authoritative.

## 20. Canonical Login Boundary

Canonical login now starts with a short-lived host-only HttpOnly CSRF and continuation cookie pair. The login page receives the random nonce from its same-origin bootstrap route, sends it in a JSON request header, and the credential route requires both that token and the exact Canonical Origin. The Arena authorize continuation is validated before storage and read only from the browser-bound cookie after successful authentication.

## 21. Remaining Phase 2D Review Items

Perform DB-backed exchange/replay tests, distributed rate-limit integration, browser cookie/redirect integration tests, trusted cleanup scheduling, and final authorization review.
