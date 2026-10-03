# Unified admin integration — Arena handoff

Status on 3 October 2026. `docs/UNIFIED-ADMIN-PRD.md` is the shared specification.

The unified admin lives in `sekolah-karir-website` and drives Arena through
Arena's existing internal HTTP routes. Arena keeps its API, database, audit log
and buyer entitlements; no second admin panel was built here.

**Not done, and not to be reported as done:** the central panel is not deployed,
nothing in this document has run against staging or production, and the panel
does not have parity with Arena's own console (see [Parity](#parity)). The
legacy console's source and data are untouched.

## Where the work is

| Branch | Contents | State |
| --- | --- | --- |
| `codex/unified-admin-20261002` (`3dd730a`) | Admin API for products, orders, inventory; product + audit transaction; `expectedUpdatedAt`; a build-time redirect of the legacy console | On origin. **Do not deploy on its own** — see next section |
| `claude/unified-admin-release-gate` (on top of `3dd730a`) | Runtime release gate replacing that redirect; separate central-admin credential; `users.createdAt`; `PRODUCT_SLUG_TAKEN`; field-level product errors; audited flag reason; the write-contract suite; `UNIFIED-ADMIN-API-CONTRACT.md`; this document | Pushed to origin for review. Not merged, not deployed |

The complete per-endpoint contract for the panel — method, payload, response,
scope, validation, reason, audit, idempotency — is
[`UNIFIED-ADMIN-API-CONTRACT.md`](UNIFIED-ADMIN-API-CONTRACT.md).

## Release gate: the API ships without retiring the console

### What was wrong

`3dd730a` declared the redirect in `next.config.mjs` `redirects()`. Next
evaluates that at **build** time and writes the result into
`.next/routes-manifest.json`. Two consequences, both reproduced:

- The redirect was on in every image, so deploying the API retired the only
  working admin on the same day — before the central panel existed.
- The destination was computed from the build's `SK_AUTH_ORIGIN`. The Dockerfile
  builds with the placeholder `http://localhost:3000`, so the production image
  redirected operators to `http://localhost:3000/admin/integrations/arena`.
  Changing or reverting it needed a rebuild.

### What replaces it

`src/proxy.ts` decides per request, from the running container's environment.
The rules live in `src/server/admin/central-admin.ts`.

| Variable | Default | Effect |
| --- | --- | --- |
| `ARENA_CENTRAL_ADMIN_URL` | unset | **Unset: the legacy console is served exactly as before.** Set to the panel's URL: `/app/admin`, `/admin` and covered sections answer `307` to that URL with `Cache-Control: no-store` |
| `ARENA_LEGACY_ADMIN_KEEP` | unset | Sections that stay on the legacy console while the redirect is on. Unset keeps the built-in list below; a comma-separated list replaces it; `none` redirects everything |

Built-in kept sections (`LEGACY_ONLY_SECTIONS`):

- no screen in the panel: `flags`, `email`, `jobs`, `workflows`, `careers`,
  `career-report`, `cv-scanner`;
- a screen in the panel, but missing an action only this console has: `store`,
  `users`, `rewards`, `projects`, `divisions`, `reviews` (details under
  [Parity](#parity)).

Redirecting them would not move the work, it would remove it — refunds, the
emergency switches and the email outbox would become unreachable mid-incident.
Only `weeks` and `audit` are fully covered today (`CENTRAL_COVERED_SECTIONS`),
so with the switch on the redirect applies to the console root, `/admin`,
`weeks` and `audit`. Kept sections stay reachable by their own URL, with the
legacy navigation; the panel should link to them until it replaces them.

The suite fails if a folder under `/app/admin` is in neither list, so a section
added later has to be classified rather than silently redirected.

Safety properties, each covered by `scripts/unified-admin-redirect.test.mjs`:

- The proxy matcher covers `/app/admin` and `/admin` only. `/api/internal/*` is
  never redirected, so the panel cannot be cut off from Arena by this switch.
- A destination that is not an absolute HTTPS URL, carries credentials or a
  query string, or points at Arena's own origin is **ignored**: the console
  stays, and the reason is logged once. Plain HTTP is accepted only for a
  loopback panel outside production.
- `next.config.mjs` declares no redirects and the Dockerfile does not mention
  the variable, so nothing about the destination can be baked into an image.

### Turning it on, and rolling back

On: set `ARENA_CENTRAL_ADMIN_URL=https://www.sekolahkarir.id/admin/integrations/arena`
in the runtime env file and recreate the container. Precondition: that URL is
live on the production website and an operator has used it against this Arena.
Today that path exists only on the website's unmerged branch and returns 404 on
`www`, so the variable must stay unset.

Rollback: empty the variable and recreate the container. No rebuild, no image
change, no data change. Because the redirect is a `307` with `no-store`,
browsers do not remember it.

## Authentication

Unchanged rules: bearer credentials are compared in constant time, an explicit
`Authorization` header never falls back to the session, the actor recorded in
`audit.logs` comes from server configuration and never from the request body,
and a missing or insufficient credential answers `403 FORBIDDEN`.

### The panel has its own credential

`INTERNAL_ADMIN_TOKEN` already has a holder: n8n's ad-hoc launch workflow, with
scope `projects`. Reusing it for the panel would mean widening it to nearly
every scope — n8n would then hold the right to refund orders and suspend users,
and both callers would be written to the audit log under one subject. So the
panel authenticates with a second, independent credential:

| Variable | Rule |
| --- | --- |
| `CENTRAL_ADMIN_TOKEN` | At least 32 characters. Must differ from `INTERNAL_AUTOMATION_TOKEN` and from `INTERNAL_ADMIN_TOKEN`; a copy of either is ignored. The website stores the same value as its `ARENA_ADMIN_TOKEN` |
| `CENTRAL_ADMIN_SUBJECT` | Required. The actor written to `audit.logs`, e.g. `central-admin:sekolahkarir-website` |
| `CENTRAL_ADMIN_SCOPES` | Required; no implicit "all". What the panel uses today: `overview,reviews,weeks,projects,rewards,users,store` |

All three unset means the panel has no access and nothing else changes. Each
credential keeps its own scopes; neither widens the other. `careers`, `storage`
and `notifications` are deliberately left out until the panel has a screen that
needs them. `INTERNAL_ADMIN_*` stays as it is for n8n.

Covered by `scripts/admin-auth.test.mjs` (10 tests), including: no subject, no
scopes, short token, token equal to the worker's, token equal to the workflow's,
a typo in the scope list, and a bearer presented alongside an admin session.

## Routes the panel uses

| Panel module | Arena route | Scope |
| --- | --- | --- |
| Overview / connection check | `GET /api/internal/admin/overview` | `overview` |
| Activity | `GET /api/internal/admin/audit` | `overview` |
| Products | `GET/POST /api/internal/store/products`, `PUT /api/internal/store/products/{id}` | `store` |
| Orders | `GET /api/internal/store/orders` | `store` |
| Projects | `/api/internal/admin/projects…` | `projects` |
| Divisions | `/api/internal/admin/divisions` | `projects` |
| Weeks | `/api/internal/weeks…` | `weeks` |
| Reviews | `/api/internal/reviews/admin…` | `reviews` |
| Rewards | `/api/internal/rewards…` | `rewards` |
| Inventory | `GET /api/internal/rewards/inventory` | `rewards` |
| Users | `GET /api/internal/admin/users` | `users` |

Store routes keep their established prefix `/api/internal/store`; do not add
`/admin` to them. Product creation answers `201`.

### Store writes and edit conflicts

Product creation and editing commit the product and its audit record in one
transaction; a failed audit insert rolls the product write back. Updates lock
the row (`SELECT … FOR UPDATE`) before checking the version.

The panel must keep the product's returned `updatedAt` and send it as
`expectedUpdatedAt` on each full-product `PUT`. A stale value answers `409`:

```json
{"error":{"code":"PRODUCT_EDIT_CONFLICT","message":"Produk sudah diubah oleh operator lain. Muat ulang sebelum menyimpan lagi."}}
```

Reload before applying a fresh edit; never retry a stale replacement
automatically. `expectedUpdatedAt` is optional for existing Arena clients,
which keep their full-replacement behaviour. Versions advance by at least one
millisecond.

A slug already used by another product answers `409 PRODUCT_SLUG_TAKEN`
(`details.field = "slug"`) on create and on edit. That includes two saves racing
into the unique index. Until 3 October it was a generic `400 VALIDATION_ERROR`.

Other malformed requests answer `400`, and a missing product
`404 PRODUCT_NOT_FOUND`.

### Orders, inventory, users

Orders accept `q` and `offset`, ordered by `createdAt, id` so pages do not
repeat; `%` and `_` in `q` are matched literally. Inventory searches and pages
the reward catalogue and returns periods only for the rewards on the page. The
users list now includes `createdAt`.

### Changes made for the panel on 3 October

- Product validation errors carry `error.details.field` (the `ProductInput` key
  the message is about), so the panel can mark the input.
- `POST /api/internal/admin/flags` accepts an optional `reason`. The audit row
  now records `reason` and `previousClosed`. Optional so the legacy console
  keeps working; the panel should always send it.

## Verification

### Offline (3 October)

`npm run typecheck` clean; `npx eslint .` 0 errors; `npm run test:offline`
423/423, including the redirect suite (7), the admin-auth suite (10) and the
store-admin suite (10). `npm run db:check` passes.

### The write contract, against the sandbox database

`npm run test:local:unified-admin` (9 cases) calls each route that until now
only the legacy console used, through the real handler, with the central
bearer and on isolated fixtures. It checks the response body, the changed rows
and the audit row under the panel's subject:

- suspend/restore;
- the four stock and catalogue actions;
- points refund, cancel and manual fulfil, each repeated to prove it is safe;
- the IDR refund refusal;
- flags with a reason;
- rubric freeze-once;
- project regenerate, and cover without a provider;
- enrolment void, once only;
- email outbox scope, cancel and requeue (nothing is sent);
- a real signed upload to the local bucket, followed by a FILE product.

The suite asserts that the AI, voucher and email keys are blank before it
starts. `npm run test:local:all` (lifecycle 8, jobs 20, privacy 8, unified
admin 9) passes.

### Against a real database — local only

Sandbox Postgres (`compose.local.yml`), Arena running as a real HTTP server,
called both directly and through the website's own gateway code:

- Product create → edit → stale edit `409` → two concurrent edits: exactly one
  `200` and one `409` → archive. Audit rows: one create and three updates, each
  under the configured operator subject.
- Orders paging and search; inventory period scoping; every collection returns
  the fields the panel reads.
- Scopes enforced per route; the admin bearer is refused on the worker and cron
  endpoints; no bearer and a wrong bearer answer `403`.
- The central credential alone (no `INTERNAL_ADMIN_TOKEN`) passes the read
  checks and is refused on `careers` and `notifications` routes.
- One production build, three runtime states: variable unset → console served;
  set → `307` to the panel; unsafe value → console served and one log line.
  `/api/internal/*` is never redirected in any of them.

### Reproducing it

```bash
ARENA_ADMIN_ORIGIN=<arena origin> ARENA_ADMIN_TOKEN=<central admin bearer> \
  node --import ./scripts/node-test-hooks.mjs scripts/unified-admin-live-check.mjs
```

Read-only by default and safe to point at staging or production. `--gateway
<path to sekolah-karir-website>` sends every call through the website's gateway
instead of calling Arena directly. `--mutations` creates and archives a test
product and is refused unless the origin is loopback.

### Through the real panel in a browser — local only

The website's own server (`next dev` on loopback, a real signed admin cookie,
headless Chrome) drove this Arena sandbox through its gateway: all ten tabs
read correctly, and 24/24 checks passed. The audit log matched the clicks
exactly, every row under the configured subject. Those clicks were: create a
product, edit its price, open two edit tabs (tab B saved, tab A was refused with
the conflict message and wrote nothing), a duplicate slug (refused, nothing
written), create a division, and create a week. No generation, publication,
finalisation, reward fulfilment or voucher push was triggered.

Arena was then restarted with `ARENA_CENTRAL_ADMIN_URL` pointing at that local
panel. `/app/admin`, `/admin`, `weeks` and `audit` answered `307` to the panel.
`store`, `flags`, `users` and `divisions` stayed on Arena. The bearer API was
unaffected.

### Found by the website's own pass

The website gateway compared a mutation's `Origin` with `request.url`, which
Next builds from its own bind hostname, so a genuine same-origin save from a
browser was refused with 403. Fixed on the website side (local commit
`0eb080e`): the `Origin` host must equal the first `x-forwarded-host`, or
`Host`. Nothing changed in Arena.

### Not verified

Nothing has run against staging or production. The panel's browser UI has not
been exercised by an operator against a deployed Arena. Until that has
happened, treat the integration as untested in the place that matters.

## Parity and feature checklist

The panel does **not** replace the legacy console yet. A section may leave
`ARENA_LEGACY_ADMIN_KEEP` only after the panel has every action it lists **and**
that has been run against Arena, sandbox first.

Arena's side of every action below exists, accepts the panel's bearer, and —
except where marked — is verified by the write-contract suite. What remains is
the panel's screen, or an owner decision.

- [x] Read tabs, product create/edit with conflict and slug codes, division
      create, week create — in the panel, browser-tested.
- [ ] `users` — suspend/restore. Arena ready. The panel must prevent
      self-suspension: Arena cannot tell which operator is acting.
- [ ] `flags` — switch view and toggle with reason. Arena ready.
- [ ] `divisions` — rubric authoring (irreversible, needs a confirm). Arena
      ready.
- [ ] `reviews` — enrolment void. Arena ready; the website gateway needs an
      allowlist entry for `/api/internal/enrollments/{id}/void`.
- [ ] `rewards` — stock, catalogue, delivery link: Arena ready. Voucher push and
      void retry call the main site's voucher API: **owner decision**.
- [ ] `store` — order fulfil, cancel and points refund: Arena ready. Rupiah
      refunds stay in Midtrans; no route moves money. Manual fulfil of an IDR
      order declares money received: **owner decision** whether the panel
      offers it. File upload: Arena ready, but the bucket's CORS rule must allow
      the website origin, or the website must relay the bytes: **owner
      decision** (production storage change).
- [ ] `projects` — detail, attribute: Arena ready. Edit, regenerate and cover
      can lead to model calls: **owner decision**.
- [ ] `email`, `jobs`, `workflows` — Arena ready. They send real mail, start
      automation or call a model; the panel would also need the
      `notifications` scope: **owner decision**.
- [ ] `careers`, `career-report`, `cv-scanner` — out of scope. `AGENTS.md`
      requires the owner's explicit approval before these modules change. Not
      changed or exercised.
- [ ] Overview health signals — Arena returns them; the panel shows only
      "Terhubung".

A new division created from the panel defaults to inactive in the panel's form
until rubric authoring lands there. Arena's API default is unchanged.

## Release order across the three repositories

1. **Arena**: deploy the API with `ARENA_CENTRAL_ADMIN_URL` unset. Set
   `CENTRAL_ADMIN_TOKEN`, `CENTRAL_ADMIN_SUBJECT`, `CENTRAL_ADMIN_SCOPES`. The
   legacy console keeps working; no migration is involved.
2. **Tools** (`sekolah-karir-career`): back up, apply
   `drizzle/0009_career_admin_audit.sql` (prepared, **not applied** anywhere,
   staging included), deploy a Tools build at `9ae331b` or later, set
   `CAREER_ADMIN_TOKEN` / `CAREER_ADMIN_SUBJECT`, and run its read-only
   `scripts/smoke-internal-admin.mjs`.
   - `2bce4e9` alone must not be deployed: against real Postgres several admin
     reads and saves answered 500. The fixes are pushed (`0cfb106`,
     `9ae331b`).
   - Tools refuses every admin call (503) if `CAREER_ADMIN_TOKEN` equals its
     `CRON_SECRET` or `SESSION_SECRET`.
   - Steps 1 and 2 are independent; both come before step 3. Tools' own
     handoff has its gap list.
3. **Website**: set `ARENA_ADMIN_ORIGIN`, `ARENA_ADMIN_TOKEN` (the same value as
   Arena's `CENTRAL_ADMIN_TOKEN`), `CAREER_ADMIN_*`, and deploy the panel.
4. Run the read-only live check against production, then have an operator use
   the panel for real work.
5. Only then set `ARENA_CENTRAL_ADMIN_URL` on Arena. With the built-in kept
   list that moves the console root, `weeks` and `audit` to the panel. Shorten
   `ARENA_LEGACY_ADMIN_KEEP` section by section as the panel gains each missing
   action; `none` is the end state, and it is not reachable yet.

Each step is independently reversible, and steps 1–4 do not change what an
Arena operator sees.

## Open items that need the owner

- Review and merge of `claude/unified-admin-release-gate`. It must be merged
  before `codex/unified-admin-20261002` is deployed anywhere.
- Deploy approval for each of the three services, and for the Tools migration.
- The secrets in steps 1–3, generated and stored by the owner.
- A staging or production run of the read-only live check (step 4).
- The decisions marked in the checklist above:
  - voucher operations;
  - manual IDR fulfil;
  - bucket CORS for uploads;
  - AI-triggering project actions;
  - email and automation from the panel;
  - the careers and CV modules.
- Commits on the website branch authored as `your-email@example.com` were
  rejected by Vercel on 30 September; they need a real author before deploy.
