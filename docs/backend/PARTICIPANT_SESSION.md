# Sign-in: the shared Sekolah Karir participant session

**Decision (2026-09-05).** The Arena reads the Sekolah Karir participant cookie.
It issues no session of its own.

## Why this and not the SSO bridge

The repo contains a complete SSO bridge — PKCE authorize, callback, opaque
Arena sessions, grant introspection, two security audits. It is not on the
sign-in path, and it never was in production, because the endpoint it calls
does not exist: `sekolah-karir-website` has no `/api/sso/*` at all. That is why
`SK_AUTH_ORIGIN` refused every connection during development; the server was
not merely stopped, the loket was never built.

What the main site does have is a participant session that already works across
the domain, and an Arena deployment that has been consuming it since
2026-08-09. Matching that arrangement means a participant who is signed in
today stays signed in when this app replaces the previous one, and it needs no
work in a repository that other people are actively changing.

The bridge stays in the tree — `src/server/auth/{pkce,authorization,sso-client,
session}.ts`, `/auth/callback`, `scripts/db-sso-integration.test.mjs` — as the
documented upgrade for the day the main site grows a token endpoint. See
[AUTH_INTEGRATION_CONTRACT.md](./AUTH_INTEGRATION_CONTRACT.md). Those files are
dormant, not dead: nothing on the request path imports them.

## The contract

| | |
|---|---|
| Cookie | `sk_participant` |
| Algorithm | HS256, pinned — a token announcing anything else is refused |
| Secret | `SESSION_SECRET`, identical to the main site's |
| Claims | `sub` (Participant.id), `email`, `username`, `firstName` |
| Lifetime | 30 days, issued by the main site |
| Scope | `Domain=sekolahkarir.id` in production, so every sibling host receives it |

`COOKIE_DOMAIN` must match what the main site sets, or logout silently fails to
clear anything.

## How a request resolves

1. `getCurrentUser()` → `getParticipantUser()` reads the cookie.
2. `verifyParticipantToken()` checks the signature, the algorithm, expiry and
   the claim shape. Anything a visitor could plausibly be holding — no cookie,
   an expired one, a forged one — returns null, meaning "not signed in". Only a
   missing `SESSION_SECRET` throws, because that is a broken deployment and
   reporting it as a mass logout would send everyone hunting the wrong problem.
3. `provisionParticipant()` mirrors the account into `identity.users`, keyed on
   `sk-participant:<Participant.id>` so the Arena's own rows hang off a stable
   foreign key even if the person changes their email or username. The write
   only happens when the mirrored profile actually drifted.
4. A suspended Arena account resolves to nobody even with a valid main-site
   session, so someone can be barred from the competition without touching
   their Sekolah Karir login.

## Consequences worth knowing

**Logout is global.** `/auth/logout` clears a cookie that belongs to the whole
domain, so it signs the participant out of the main site too. There is no "log
out of the Arena only" to offer, and pretending otherwise would leave someone
signed in where they thought they had left.

**Login is a redirect.** `/auth/login` sends the visitor to the main site's
`/arena` gate, which raises the OTP modal and then offers the door back through
`/arena/enter` — the route that re-scopes a pre-split cookie so this subdomain
receives it. `returnTo` is deliberately not forwarded to another origin.

**Trust is symmetric.** Reading the main-site session means this deployment must
be trusted as much as the main site. That was already true of the Arena it
replaces; it is not a new exposure, but it is the reason a token endpoint would
be an improvement rather than a formality.

## What has to be true in production

- `SESSION_SECRET` matches the main site exactly.
- `COOKIE_DOMAIN=sekolahkarir.id`.
- `ARENA_ORIGIN=https://arena.sekolahkarir.id` (the config refuses anything else
  in production).
- The main site keeps serving `/arena` and `/arena/enter`. Those are this app's
  front door, not leftovers from the previous Arena.
