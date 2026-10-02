# Unified admin integration

The central admin connects to Arena's existing internal HTTP routes. No new Arena authentication system or duplicate admin API was added. This checkout is on `codex/unified-admin-20261002`; these changes have not been committed, deployed, or tested against a live database.

## Server bearer configuration

Configure Arena's existing `INTERNAL_ADMIN_TOKEN` with a strong server-only bearer secret, `INTERNAL_ADMIN_SUBJECT` with the identifiable operator/service subject recorded in audit entries, and `INTERNAL_ADMIN_SCOPES` with:

```text
overview,reviews,weeks,projects,rewards,users,careers,store
```

The central server sends `Authorization: Bearer <INTERNAL_ADMIN_TOKEN>` to Arena. Credentials must stay on the server. The token must differ from `INTERNAL_AUTOMATION_TOKEN`. Missing credentials, an incorrect bearer, a missing operator subject, or insufficient scope returns HTTP 403 `FORBIDDEN`. The existing session authorization remains available to Arena's own admin console.

## Existing route paths

Use `GET /api/internal/admin/overview` for the connection health check: it exercises the real bearer, overview permission, and backend rather than reporting a fabricated health status. Arena operational routes remain under `/api/internal/admin` (overview, reviews, weeks, projects, rewards, users, and careers). Store routes have their established prefix `/api/internal/store`, including `GET/POST /api/internal/store/products` and `PUT /api/internal/store/products/{id}`. Use the route's existing method and request contract; do not add `/admin` to store paths.

## Store writes and edit conflicts

Product creation and editing now commit the product and its audit record in one database transaction. Failed audit insertion rolls back the product write. Updates lock the saved product row before checking its version and writing the replacement, so two edits cannot both pass the version check against the same row.

The central UI must preserve the product's returned `updatedAt` and send it as the ISO timestamp `expectedUpdatedAt` on each full-product PUT. A stale timestamp returns HTTP 409 with:

```json
{"error":{"code":"PRODUCT_EDIT_CONFLICT","message":"Produk sudah diubah oleh operator lain. Muat ulang sebelum menyimpan lagi."}}
```

Reload the product before applying a fresh edit; do not automatically retry a stale replacement. The timestamp is optional for existing Arena clients; clients omitting it retain their previous full-replacement behavior. Version timestamps advance by at least one millisecond even for immediate repeated writes. Existing normalization, ACTIVE validation, delivery storage checks, and access entitlement rules remain in use.

Malformed product/version requests return HTTP 400 through the existing validation response. Missing products return HTTP 404 `PRODUCT_NOT_FOUND`. Unexpected persistence/audit failures return HTTP 500 `INTERNAL_ERROR` through the existing error handler.

## Offline verification

Final 2 October verification: full TypeScript exit0; scoped lint exit0; product/order/inventory/redirect scoped suites14 passed, earlier broader store suite29 passed. No PostgreSQL integration or production smoke. `docs/UNIFIED-ADMIN-PRD.md` is the portable shared specification.

Legacy admin menus: next.config.mjs redirects `/app/admin/:path*` and `/admin/:path*` to SK_AUTH_ORIGIN + `/admin/integrations/arena` (default main website www). Redirect is temporary and validates HTTPS/root origin; isolated loopback allowed for development/test. APIs/services/data remain. Deploy the central panel BEFORE releasing the redirect. Features not migrated to the new UI (email, flags, CV reports, feed setup, rubric authoring, advanced automation) retain APIs, not a second visible admin menu.

Orders now support q/offset and stable createdAt/id pagination. Inventory now searches/paginates reward catalog and scopes all periods to selected reward IDs (no global200-period cap falsely hiding stock). Central UI pages catalog20 at a time and preserves period grouping.

User authorized push branch codex/unified-admin-20261002 for the admin API/code/handoff, not production deployment. Other dirty docs/automation/CV changes remain excluded. operations.ts has unrelated review-integrity changes: only inventory hunk belongs to this feature.

`node --import ./scripts/node-test-hooks.mjs --test scripts/store-admin.test.mjs` exercises real store service, schema, route, audit writer, and error mapping with a transaction-capable in-memory persistence double. It never opens a database connection or uses production configuration. Tests cover creation/update rollback on audit failure, stale edits, repeated-version conflicts, version forwarding, and legacy clients. Run `npm run typecheck` for TypeScript validation. Live PostgreSQL locking/rollback and deployment validation are still operator follow-up work.
