# Arena Authentication Integration Contract

## Canonical Identity Provider / System

Sekolah Karir Workspace at `D:\Sekolah Karir Workspace` is the canonical identity authority. Its observed implementation is custom PostgreSQL-backed auth with bcrypt credentials and opaque database sessions.

## Canonical User Subject

`D:\Sekolah Karir Workspace` `users.id` UUID.

## Arena Mapping

Canonical: `users.id` UUID, serialized as a stable subject string.

Arena: `identity.users.auth_subject`.

Email and profile fields are cache values only.

## Session Verification Flow

Arena must verify the canonical identity server-side through the approved bridge. It must not accept a user ID, role, or email from a request body or client storage. After verification, Arena loads or JIT-provisions its `identity.users` mapping and establishes an Arena-scoped host-only session.

The current `skw_session` cookie is host-only and cannot be verified by Arena under the observed contract.

## Login Flow

UNRESOLVED - CANONICAL AUTH SOURCE REQUIRED for the exact login endpoint and callback contract.

Target flow: Arena redirects to canonical Sekolah Karir auth with an exact allowlisted return URL and state/nonce; the canonical system returns a short-lived, one-time authorization code; Arena exchanges/verifies it server-side and creates its scoped session.

## Logout Flow

UNRESOLVED - CANONICAL LOGOUT PROPAGATION REQUIRED.

At minimum, Arena must invalidate its own session and clear its host-only cookie. Whether it also redirects to canonical Sekolah Karir logout must be confirmed.

## Expired / Invalid Session Behavior

Clear the Arena session, return 401 for API requests, and redirect browser navigation to canonical login with a safe fixed return target. Never reveal session values or accept a client-supplied identity as fallback.

## Suspended User Behavior

Reject the request after canonical verification or current Arena status lookup. Do not permit stale cached profile data to bypass suspension. The canonical Workspace currently rejects non-ACTIVE users during session lookup.

## Arena JIT Provisioning

After successful verification, select by `identity.users.auth_subject`. Insert the mapping if missing; update only cache fields from the verified canonical response. Use an idempotent server transaction keyed by `auth_subject`.

## User Cache Fields

`email_cache`, `display_name_cache`, and `avatar_url_cache` are non-authoritative display caches. They never determine identity or authorization.

## Server Authorization Rule

NEVER trust client-provided user IDs for ownership.

Every protected Arena resource query must derive ownership from the authenticated server-side subject and apply resource/week scope in the database query.

## Subdomain Policy

Arena should use its own host-only session unless the canonical auth owner explicitly approves another design. Do not broaden `skw_session` to `.sekolahkarir.id` without a shared verifier, threat model, CSRF plan, and coordinated logout contract.

## Cookie Policy

Observed canonical cookie: `skw_session`, HttpOnly, SameSite=Lax, Secure when `APP_URL` is HTTPS, Path `/`, 14-day MaxAge, no Domain attribute. Values are never logged or copied.

Arena cookie name, expiry, and exact attributes are UNRESOLVED - CANONICAL AUTH SOURCE REQUIRED. Target: host-only, HttpOnly, Secure in production, explicit SameSite, Path `/`, and bounded expiry.

## CSRF / Origin Policy

Require state/nonce for redirects, exact callback and origin allowlists, one-time short-lived codes, and CSRF protection on state-changing Arena endpoints. SameSite is defense-in-depth, not the sole control.

## Redirect Allowlist

UNRESOLVED - CANONICAL AUTH SOURCE REQUIRED.

Allow only the registered production Arena origin and explicitly approved local development origins. Never reflect an arbitrary `returnTo` URL.

## Admin Authorization Boundary

Canonical identity remains centralized. Arena admin authorization is app-specific until the auth owner confirms a canonical role claim with the required meaning. Do not create Arena credentials or silently treat Workspace executive roles as Arena administrators.

## Required Environment Variable Names

`DATABASE_URL`, `AUTH_BRIDGE_URL`, `AUTH_BRIDGE_CLIENT_ID`, `AUTH_BRIDGE_CLIENT_SECRET`, `AUTH_BRIDGE_SIGNING_KEY`, `AUTH_CALLBACK_URL`, `AUTH_ALLOWED_ORIGINS`, `AUTH_SESSION_SECRET`.

Names are provisional except `DATABASE_URL`, which already exists in Arena Phase 1. No values are configured by this audit.

## Phase 2B Implementation Checklist

- [ ] Obtain the canonical auth owner’s bridge endpoint, subject claim, client registration, and verification method.
- [ ] Confirm production and local callback/origin allowlists.
- [ ] Implement state/nonce, one-time-code, TTL, replay, and open-redirect protections.
- [ ] Implement server-only subject verification and JIT mapping to `identity.users.auth_subject`.
- [ ] Implement Arena-scoped session creation, expiry, logout, and suspension handling.
- [ ] Add server authorization helpers for every user-owned Arena resource.
- [ ] Replace mock login/logout action wiring without changing approved visuals.
- [ ] Add integration tests with redacted fixtures; never use real credentials or session values.
