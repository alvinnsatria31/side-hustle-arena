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

**Login is a popup, not a departure.** `/auth/login` still sends the browser to
the main site's `/arena` gate — that gate raises the OTP modal and then offers
the door back through `/arena/enter`, the route that re-scopes a pre-split
cookie so this subdomain receives it. What changed on 2026-09-06 is *which*
browsing context makes that trip: `signInWithPopup()` opens the gate in a popup
window and leaves the Arena page standing behind it, so a participant who was
reading a project brief returns to that brief rather than to a generic landing.

The handshake is polling, not `postMessage`. The gate is a different origin, so
nothing on this page may read that window beyond `closed` — but the cookie it
sets is scoped to the registrable domain, so our own origin can simply look.
`GET /api/auth/session` answers `{ signedIn }` from the token alone (no
database, no user mirror), the popup polls it once a second, and the first
`true` closes the window and reloads onto the destination. Nothing has to be
agreed with `sekolah-karir-website` for this to work, and nothing breaks there
when the gate changes where it redirects afterwards.

A blocked popup falls back to handing over the whole tab, which is exactly the
old behaviour. `returnTo` is still never forwarded to another origin; it is
sanitised by `sanitizeInternalReturnPath` and applied on the way back, on this
origin only.

**Trust is symmetric.** Reading the main-site session means this deployment must
be trusted as much as the main site. That was already true of the Arena it
replaces; it is not a new exposure, but it is the reason a token endpoint would
be an improvement rather than a formality.

## What has to be true in production

- `SESSION_SECRET` matches the main site exactly.
- `COOKIE_DOMAIN=sekolahkarir.id`.
- `ARENA_ORIGIN=https://arena.sekolahkarir.id` (the config refuses anything else
  in production).
- `SK_AUTH_ORIGIN` points at the host that actually serves the gate —
  `https://www.sekolahkarir.id`. The apex only 308-redirects there, so it works
  but costs a hop; unset, the config defaults to `www`.
- The main site keeps serving `/arena` and `/arena/enter`. Those are this app's
  front door, not leftovers from the previous Arena — and now they are also what
  runs inside the sign-in popup, so neither may refuse to render in a
  `window.open`ed context (no `Cross-Origin-Opener-Policy: same-origin` on the
  gate, no framebusting redirect to the apex).
- This app sends no `Cross-Origin-Opener-Policy` header of its own. Adding one
  would sever the opener relationship and break the popup's `closed` detection.

## What the main site does *not* have to do

Nothing. The popup flow was built to need no change in `sekolah-karir-website`,
because that repository is actively worked on by other people. Two things there
would make it nicer, and neither is required:

1. **Close the popup itself.** If `/arena/enter` detected `window.opener` and
   called `window.close()`, the popup would vanish on the spot instead of a beat
   later when our poll notices. Purely cosmetic — the poll already closes it.
2. **A token endpoint.** The dormant PKCE bridge
   ([AUTH_INTEGRATION_CONTRACT.md](./AUTH_INTEGRATION_CONTRACT.md)) is the real
   upgrade: it would let the Arena render its own sign-in form instead of
   borrowing the gate. Until then the Arena cannot authenticate anyone — it
   holds no participant accounts, so it has nothing to check an OTP against.

## Arrival: picking an avatar

A participant who signed in on the main site is already authenticated here, so
the Arena asks them for exactly one thing on arrival: the avatar the leaderboard
shows. `identity.users.avatar_id` is nullable, and null is the whole trigger —
the protected layout raises `AvatarPickerModal` while it stays null, which makes
the step self-healing rather than stateful: a save that never lands simply asks
again next time.

The id is validated against the preset catalogue (`src/lib/avatars.ts`) in
`setParticipantAvatar`, not only in the route, because the column is rendered
straight into every surface that lists people — an unknown id would blank an
identity for everyone looking at that row, not just its owner. `avatar_id` is
Arena-owned and distinct from `avatar_url_cache`, which mirrors the main site
and is not ours to write; signing in again therefore never clears the choice.

## Why sign-in does not read the bridge's configuration

`getAuthConfig()` once parsed everything in one schema — sign-in origins, the
mutation allowlist, and the dormant bridge's `ARENA_SSO_CLIENT_ID` /
`ARENA_SSO_CLIENT_SECRET`. Those last two are deliberately unset, so the parser
threw on every call, and `/auth/login` — which never reads them — answered 500.
The login button was dead in production: every entry point funnels through that
route, so nobody could sign in at all.

The configuration is now split by concern in `src/server/auth/config-core.ts`,
one parser per caller:

| Caller | Reads |
|---|---|
| `/auth/login`, `/auth/logout`, `cookies.ts` | `getAuthConfig()` — `ARENA_ORIGIN`, `SK_AUTH_ORIGIN` |
| `origin.ts` (every state-changing route) | `getArenaMutationOrigins()` — `ARENA_ALLOWED_ORIGINS` |
| `sso-client.ts` (dormant) | `getSsoBridgeConfig()` — the client credentials |

A misconfigured value now disables the thing it configures and nothing else. The
bridge can stay unconfigured forever without touching sign-in.

`ARENA_ALLOWED_ORIGINS` is the real control on cross-origin writes, not defence
in depth: `sk_participant` is scoped to the registrable domain, so SameSite=Lax
still sends it on a request from a sibling host. Production accepts only
`ARENA_ORIGIN` and `SK_AUTH_ORIGIN` there — first-party origins already trusted
with the shared session — and refuses anything else.
