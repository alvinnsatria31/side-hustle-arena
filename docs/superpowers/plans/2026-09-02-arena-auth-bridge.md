# Arena Central Auth Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reuse canonical Sekolah Karir identity through a short-lived, one-time authorization code with PKCE, then establish an Arena-only opaque server session.

**Architecture:** The canonical Workspace remains the only password and `skw_session` authority. It creates hashed authorization codes tied to the existing canonical session, atomically exchanges them for revocable grants, and exposes authenticated introspection/revocation routes. Arena validates redirect state and PKCE, exchanges server-to-server, JIT maps `users.id` to `identity.users.auth_subject`, and uses a host-only `arena_session` cookie backed by a hashed local token.

**Tech Stack:** Next.js 16 route handlers/App Router, TypeScript, Drizzle ORM, PostgreSQL, Zod, Node `crypto`, and Node’s built-in test runner.

---

### Task 1: Canonical bridge security primitives and schema

**Files:**
- Create: `D:/Sekolah Karir Workspace/src/lib/sso/arena.ts`
- Modify: `D:/Sekolah Karir Workspace/src/db/schema.ts`
- Test: `D:/Sekolah Karir Workspace/src/lib/sso/arena.test.ts`

- [ ] **Step 1: Write failing tests** for SHA-256 code hashing, S256 PKCE verification, exact redirect URI matching, and constant-time client-secret comparison.

```ts
assert.equal(verifyPkce("known-verifier", toS256Challenge("known-verifier")), true);
assert.equal(isAllowedRedirectUri("https://arena.sekolahkarir.id/auth/callback", configured), true);
assert.equal(isAllowedRedirectUri("https://arena.sekolahkarir.id/auth/callback?next=/", configured), false);
```

- [ ] **Step 2: Run the focused test** with `node --test src/lib/sso/arena.test.ts`; observe failure because the module does not yet exist.
- [ ] **Step 3: Implement the smallest server-only helpers**: configured `arena` client validation, 60-second code expiry, hashed code generation, S256 verification, and exact configured redirect allowlist.
- [ ] **Step 4: Add `sso_authorization_codes` and `sso_grants`** to the existing canonical Drizzle schema, including code hash uniqueness, source session references, expiry/revocation fields, and query indexes.
- [ ] **Step 5: Run the focused test again**; observe a pass.

### Task 2: Canonical authorize, exchange, introspection, revoke, and logout propagation

**Files:**
- Create: `D:/Sekolah Karir Workspace/src/app/api/sso/arena/authorize/route.ts`
- Create: `D:/Sekolah Karir Workspace/src/app/api/sso/arena/token/route.ts`
- Create: `D:/Sekolah Karir Workspace/src/app/api/sso/arena/introspect/route.ts`
- Create: `D:/Sekolah Karir Workspace/src/app/api/sso/arena/revoke/route.ts`
- Modify: `D:/Sekolah Karir Workspace/src/app/api/auth/logout/route.ts`
- Test: `D:/Sekolah Karir Workspace/src/lib/sso/arena.test.ts`

- [ ] **Step 1: Add failing unit tests** for wrong verifier rejection, expired/consumed-code decisions, and inactive user rejection predicates.
- [ ] **Step 2: Run `node --test src/lib/sso/arena.test.ts`** and observe these new assertions fail.
- [ ] **Step 3: Implement route handlers** that use `getSessionUser()` for authorize, authenticate server-to-server calls with the configured secret, validate Zod input, atomically consume codes and create grants in a transaction, and expose only subject/grant/expiry/profile cache data.
- [ ] **Step 4: Revoke grants by canonical session during canonical logout** before the existing session deletion; preserve `skw_session` cookie behavior.
- [ ] **Step 5: Re-run the test** and inspect that it passes.

### Task 3: Arena security utilities, local session schema, and bridge client

**Files:**
- Create: `src/server/auth/config.ts`
- Create: `src/server/auth/crypto.ts`
- Create: `src/server/auth/pkce.ts`
- Create: `src/server/auth/return-path.ts`
- Create: `src/server/auth/sso-client.ts`
- Modify: `src/server/db/schema/identity.ts`
- Test: `src/server/auth/auth-security.test.ts`

- [ ] **Step 1: Write failing tests** for valid internal return paths, external/protocol-relative/javascript/backslash return rejection, stable session hashing, and known S256 output.

```ts
assert.equal(sanitizeInternalReturnPath("/app/arena/projects/x"), "/app/arena/projects/x");
assert.equal(sanitizeInternalReturnPath("//evil.example"), "/app");
assert.equal(sanitizeInternalReturnPath("javascript:alert(1)"), "/app");
```

- [ ] **Step 2: Run `node --test src/server/auth/auth-security.test.ts`** and observe the missing-module failure.
- [ ] **Step 3: Implement server-only config and crypto helpers** with standard `node:crypto`, strict Zod configuration, one configured canonical origin, S256 PKCE, fixed timeout/response validation, and no browser-exposed secret.
- [ ] **Step 4: Add `identity.sessions`** with hashed token, user ID, canonical grant ID, bounded expiry, revocation/check timestamps, and indexes. Keep `identity.users.auth_subject` unchanged.
- [ ] **Step 5: Re-run the focused test** and observe a pass.

### Task 4: Arena routes, server current-user lookup, authorization boundary, and minimal visual wiring

**Files:**
- Create: `src/server/auth/cookies.ts`
- Create: `src/server/auth/session.ts`
- Create: `src/server/auth/current-user.ts`
- Create: `src/server/auth/authorization.ts`
- Create: `src/server/auth/origin.ts`
- Create: `src/server/auth/index.ts`
- Create: `src/app/auth/login/route.ts`
- Create: `src/app/auth/callback/route.ts`
- Create: `src/app/auth/logout/route.ts`
- Modify: `src/app/(app)/layout.tsx`
- Modify: `src/app/(public)/login/page.tsx`
- Modify: `src/components/layout/LoginModal.tsx`
- Test: `src/server/auth/auth-security.test.ts`

- [ ] **Step 1: Add failing tests** for empty/wrong state decisions, session expiry bounded to grant expiry, and fail-closed introspection result handling.
- [ ] **Step 2: Run the focused test** and observe expected failure.
- [ ] **Step 3: Implement login/callback/logout handlers** with host-only HttpOnly cookies, state/PKCE temporary cookies, server-side exchange, JIT user mapping by canonical UUID string, local hashed session creation, same-origin logout validation, and best-effort grant revocation.
- [ ] **Step 4: Implement `getCurrentUser`, `requireCurrentUser`, and a minimal ownership assertion** sourced solely from the server session. Add a five-minute configurable canonical grant recheck that invalidates locally and fails closed when revalidation is due but unavailable.
- [ ] **Step 5: Convert the `/app` layout to a Node server boundary** while retaining the existing client chrome underneath it. Replace the password form/modal actions with links to `/auth/login`; preserve their visual hierarchy and do not alter unrelated demo data behavior.
- [ ] **Step 6: Re-run the focused test** and observe a pass.

### Task 5: Append-only migrations, documentation, and verification

**Files:**
- Create: `drizzle/<generated Arena migration>`
- Create: `D:/Sekolah Karir Workspace/drizzle/<generated canonical migration>`
- Create: `docs/backend/AUTH_IMPLEMENTATION.md`
- Create: `docs/backend/AUTH_SECURITY_BOUNDARY.md`
- Modify: `.env.example`
- Modify: `docs/backend/IMPLEMENTATION_STATUS.md`

- [ ] **Step 1: Generate migrations offline** using each repository’s existing `db:generate`; do not run either migrator.
- [ ] **Step 2: Add names-only environment template entries** for the configured origin, client ID/secret, allowed redirects/origins, and introspection interval.
- [ ] **Step 3: Document the trust boundary**: canonical-only `skw_session`, browser-transit one-use code, Arena-only verifier/session cookie, server-only client secret, grant ID not being a bearer credential, fail-closed revalidation, deferred admin mapping, and remaining Phase 2C audit.
- [ ] **Step 4: Verify** `node --test` security utilities, both lint/build/type checks where available, both migration generations, and both `git diff --check` commands. Do not claim database-backed SSO runtime verification without a database-backed integration test.
- [ ] **Step 5: Inspect staged files only** and commit the intended Arena changes as `feat: add Arena authentication bridge` and canonical changes as `feat: add Arena SSO bridge`; do not push.
