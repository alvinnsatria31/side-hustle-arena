# Private CV scan history

Successful `/api/cv-scan` analyses can be saved to the authenticated participant's account. The upload checkbox is off by default; multipart `saveHistory=true` is explicit consent. Only the scanner's server-generated, validated result is accepted for storage. There is no endpoint that accepts a browser-supplied analysis or score.

`arena.cv_scans` stores `id`, `user_id`, `result` JSONB and `created_at`, with an owner/time index and cascading owner FK. Raw CV bytes and full extracted document text are never written to this table or file storage. The analysis includes the file name, findings and potentially short original CV lines in impact examples; the consent UI discloses this. Results loaded from history are fetched with no-store and are not copied into the existing demo/localStorage store. Newly scanned results retain the existing browser-local result behavior.

Hardcoded policy: retain the latest **50** analyses per account. A per-owner row lock serializes saves; inserting a new result and deleting results beyond the limit occur in one transaction. The upload checkbox explains automatic removal of older results. List output includes only id, filename, score and creation date. History records can be opened or deleted on the scanner upload page.

## API and integration

- `POST /api/cv-scan`: scan with optional `saveHistory=true`; returns `data.result` and `data.save`. Save status is `not_requested`, `saved` (with `id`), `sign_in_required`, or `failed`.
- `GET /api/cv-scan/history`: authenticated owner's latest 50 summaries.
- `GET /api/cv-scan/history/:id`: owner's analysis; foreign/missing/invalid IDs return 404.
- `DELETE /api/cv-scan/history/:id`: deletes only the authenticated owner's result; requires the existing mutation-origin allowlist. Opt-in scan requests use the same origin check.
- `getLatestCvScan(userId, db?)` from `src/server/cv/history.ts` returns `{ id, result, createdAt } | null` for Career Report. `createdAt` is a `Date` in service calls and an ISO string over HTTP.

Without save opt-in, the scan path does not invoke authentication or database access. A missing login or history persistence failure never discards a completed analysis. The UI reports save failure and explains that saving requires signing in if necessary and scanning again with consent. There is intentionally no replay/save-token or client-result retry endpoint.

The actual scanner remains dependent on existing AI provider configuration and its feature flag. History does not invent fallback results. The project CTA browses the existing project catalog; it no longer claims a mock project is a personalized recommendation.

## Migration and verification

Generated migration: `drizzle/0010_neat_psylocke.sql`. Apply through the existing migration workflow, before using history. No new environment variables or dependencies are required.

Offline checks:

```powershell
node --import ./scripts/node-test-hooks.mjs --test scripts/cv-history.test.mjs
```

After applying the migration to the development DB, run separately from other DB suites:

```powershell
node --import ./scripts/node-test-hooks.mjs --test --test-force-exit scripts/cv-history-db.test.mjs
```

The DB test requires `APP_ENV=development`, creates synthetic fixture owners/results, checks own-read/delete, cross-owner isolation, latest-result selection, retention and table shape, then removes its fixtures. No real CV or external AI call is used. Offline tests cover opt-out without auth/storage, authenticated attribution, missing session, persistence failure, bounded validation and the migration contract.

Deferred: configurable retention, history pagination/export, and retry without another analysis. The 50-record policy is hardcoded above and in the consent copy, not an admin setting.
