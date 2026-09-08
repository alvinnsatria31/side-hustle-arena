# Jobs pipeline — operations guide

The Jobs product ingests real openings from external providers, normalizes them
into `arena.job_openings`, resolves their skills against the shared taxonomy,
and serves only what is currently open to a signed-in participant.

**No provider has been chosen yet, and the pipeline does not wait for one.**
Everything below the adapter boundary is finished and tested; connecting a real
board is one adapter (or zero, if it speaks JSON over HTTPS) plus one row in
`arena.job_sources`. Nothing in the business logic knows a vendor's name.

Until a source is registered, the participant Jobs page is honestly empty and
says so. It does **not** fall back to sample data: the previous six hardcoded
"(fiktif)" openings are gone from the server entirely, and the only fixture that
remains refuses to run outside the local sandbox.

---

## 1. Data model

Migration `0012_charming_kitty_pryde.sql`, all in the `arena` schema.

| Table | What it holds |
|---|---|
| `job_sources` | One row per provider: adapter name, non-secret config, the **name** of the env var holding its credential, sync interval, staleness policy, cursor, health counters, and a worker lease. |
| `job_openings` | Normalized openings. `(source_id, external_id)` is the provider's identity and the upsert key; `canonical_key` is ours (normalized title+company+location) so the same role from two boards is recognisable. |
| `job_opening_skills` | Taxonomy-resolved skills per opening, with the provider text that resolved to each. |
| `skill_aliases` | The shared vocabulary (also used by Career Report and CV). One alias row teaches the system a spelling without a deploy. |
| `job_sync_runs` | One row per sync attempt, successful or not: counts, cursor before/after, error code, who triggered it. |

Two properties are worth stating because code elsewhere depends on them:

- **Nothing is ever deleted when it vanishes from a feed.** Openings move
  `OPEN → EXPIRED | STALE → CLOSED`, and a closed row stays. A feed can drop an
  item because the role closed, or because page three returned a 500; deleting
  on absence would silently erase history in the second case.
- **No secret is ever stored.** `credential_env_var` holds a variable *name*.
  A database dump, an audit row and the admin API all carry the name and a
  boolean "is it set", never the value.

## 2. Connecting a real provider

### If the provider serves JSON over HTTPS

No code. Insert a row with `adapter = 'http-json'` and a config object:

```json
{
  "baseUrl": "https://api.example-board.com/v1/jobs",
  "query": { "country": "ID" },
  "headers": { "accept": "application/json" },
  "authHeader": "Authorization",
  "authScheme": "Bearer ",
  "itemsPath": "data.items",
  "nextCursorPath": "data.next_cursor",
  "cursorParam": "cursor",
  "timeoutMs": 10000,
  "maxAttempts": 3,
  "pageDelayMs": 0,
  "maxPages": 20,
  "fieldMap": {
    "externalId": "id",
    "title": "title",
    "company": "company.name",
    "location": "location.city",
    "workMode": "remote_type",
    "employmentType": "employment_type",
    "description": "description",
    "requiredSkills": "skills.required",
    "preferredSkills": "skills.preferred",
    "applicationUrl": "apply_url",
    "postedAt": "published_at",
    "expiresAt": "expires_at",
    "salaryMin": "salary.min",
    "salaryMax": "salary.max",
    "salaryCurrency": "salary.currency",
    "salaryPeriod": "salary.period"
  }
}
```

Every `fieldMap` value is a dotted path into one provider record. Only
`externalId`, `title`, `company` and `applicationUrl` are required — a provider
that omits the rest produces openings with `UNSPECIFIED`/null fields, which is
what the UI shows rather than inventing a plausible value.

```sql
insert into arena.job_sources
  (slug, name, adapter, config, credential_env_var, is_active, sync_interval_minutes, staleness_days)
values
  ('example-board', 'Example Board', 'http-json', '<the JSON above>'::jsonb,
   'JOBS_PROVIDER_TOKEN', false, 360, 7);
```

Register it **inactive**, set `JOBS_PROVIDER_TOKEN` in the environment, run one
manual sync from `/app/admin/careers`, read the run counts, then activate.

### If the provider needs something else

Write an adapter implementing `JobsAdapter` (`src/server/career/jobs/contract.ts`):
one method, `fetchPage({ config, credential, cursor, signal }) → { items, nextCursor, retryAfterMs }`.
It returns **raw provider records**; it must not normalize, must not decide
lifecycle, and must not touch the database. Register it in the `adapters` map in
`sync-service.ts`. Everything downstream is unchanged.

### Feed contract the adapter must satisfy

| Requirement | Why |
|---|---|
| HTTPS, credential-free base URL | Enforced by the config schema and again by `assertFeedTransportAllowed`. A loopback `http://` URL is permitted **only** in the local sandbox. |
| Cursor pagination | Offsets silently skip or repeat rows when a board changes underneath a paginated read. |
| A stable per-record id | Becomes `external_id`; it is the upsert key that makes a repeated sync safe. |
| An HTTPS application URL | The one field a participant clicks. Non-HTTPS, credentialed, `javascript:` and `data:` URLs are rejected and the record is counted as invalid. |
| Honest absence | A field the provider does not have should be absent, not empty-but-plausible. |

## 3. Environment variables

| Variable | Purpose |
|---|---|
| `JOBS_PROVIDER_TOKEN` (or any name you choose) | The credential for one source. The name goes in `job_sources.credential_env_var`; the value never leaves the environment. A source that names a variable which is **not** set fails its sync loudly — an unauthenticated read of a private feed returns an empty page, which looks exactly like "every job closed". |
| `JOBS_PORTAL_URL` | Optional external careers portal linked from the Jobs page. HTTPS, no credentials. |
| `CRON_SECRET` / `ARENA_CRON_TOKEN` | Already required by the scheduler; `jobs-sync` uses the same entrypoint. |

## 4. Running a sync

| How | What it does |
|---|---|
| Scheduled | n8n trigger **“Every 4 hours”** → `GET /api/cron/jobs-sync`. The job syncs only the sources that are *due* by their own `sync_interval_minutes`, so triggering more often than any source's interval is free. `vercel.json` carries a daily fallback. |
| Admin console | `/app/admin/careers` → **Tarik sekarang**. Same code path, admin actor, unique idempotency key. Requires the `careers` scope. |
| API | `POST /api/internal/admin/job-sources` with `{ sourceId, action: "sync" }`. |
| Local fixture | `npm run db:seed:jobs:fixture` then trigger a sync. Sandbox only. |

Every path is idempotent at three levels: a per-source **lease** (two workers
never page one feed at once), a keyed **run row** (a repeated trigger resumes
rather than forking), and a keyed **upsert** (re-reading a page updates, never
duplicates).

## 5. Recovery from partial failure

A sync that does not complete a full pass is recorded as `PARTIAL`, and —
this is the rule that matters — **absence is not acted on.** Openings are only
graded stale or closed after a sweep that finished. One failing page therefore
cannot close a board.

- The cursor is persisted, so the next tick resumes where it stopped.
- `consecutive_failures` drives an exponential backoff, capped at a day, so a
  broken provider is retried less often rather than hammered.
- A source stuck behind a lease (a worker died mid-sync) is claimable again
  after ten minutes; the admin page shows `leaseHeld` while it is not.
- Nothing needs manual SQL. If a source is wedged, disable it, fix the config,
  run one manual sync, read the counts, re-enable.

## 6. Monitoring

`/app/admin` shows automation health, including every non-healthy jobs source.
`/app/admin/careers` shows, per source: health, last successful sync, interval
and staleness policy, whether the named credential is set, opening counts by
status, consecutive failures with the last error code, and the last run's
counts.

Health states: `HEALTHY`, `DEGRADED` (works, but the data on screen is older
than the source promised — the state that matters most, because nothing looks
broken), `FAILING` (three or more consecutive failures), `NEVER_SYNCED`,
`DISABLED`.

## 7. Disabling a provider

`/app/admin/careers` → **Nonaktifkan**, or `POST … { action: "disable" }`.

Disabling stops new data and stops the source's openings being recommended (the
next `jobs-sync` marks its `OPEN` rows `STALE`). It does **not** close them and
does not delete anything: a disabled source's history stays queryable, because
"we stopped reading this board" and "every role on it ended" are different facts.

## 8. Tests

| Suite | Command | Covers |
|---|---|---|
| Unit | `npm run test:offline` (`scripts/jobs.test.mjs`) | Normalization, malformed records, HTTPS/URL rules, pagination and cursors, retry/backoff, rate-limit handling, budget aborts, lifecycle rules, coverage scoring, filters, the fixture adapter's guards, and a real loopback HTTP server. |
| Database integration | `npm run test:local:jobs` | Idempotent re-sync, in-place updates, checkpointing, malformed-record accounting, absence grading after failure, concurrent syncs, leases, credential handling, audit hygiene, the participant view, and the admin API routes. |
| Scheduler contract | `npm run test:offline` (`scripts/automation-contract.test.mjs`) | That the n8n workflow, `vercel.json`, the route ceilings and `EXECUTION_CONTRACT` still agree. |
| Browser | `npm run test:browser:local` | The Jobs page, coverage labelling, filters, the application link, and the admin source page. |

No test touches a live provider. The HTTP adapter is driven by an injected
`fetch` or a loopback fixture server; the database suites inject a fake adapter.

## 9. Fixture provider (local only)

`scripts/fixtures/jobs-feed.json` + the `fixture-file` adapter give the whole
pipeline something to ingest with no vendor and no credential.

```bash
node scripts/local-dev.mjs --setup-only
npm run db:seed:jobs:fixture          # register it
npm run db:seed:jobs:fixture -- --remove
```

The adapter refuses to run outside the local sandbox — checked in the adapter
itself, not only in the script that registers it, because fabricated openings
displayed as live listings is the most damaging thing this product could do and
one guard is not enough. The fixture is deliberately awkward (nested company
object, comma-joined skills, missing fields, one record with an insecure
application URL) so the normalizer is exercised rather than flattered.

---

## What still needs the owner

1. **Which provider.** A name, plus either API documentation or one sample
   response page. With those, wiring is a config row.
2. **The credential**, set in the environment under a name of your choosing.
   Do not paste it anywhere else; only the name is needed in the database.
3. **Permission to use the data.** Whether the provider's terms allow storing
   and re-displaying openings, and whether attribution is required.
4. **Sync cadence**, if a source needs something other than the 6-hour default.
