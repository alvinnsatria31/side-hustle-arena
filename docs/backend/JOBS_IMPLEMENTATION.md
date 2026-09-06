# Jobs implementation

`/app/jobs` reads authenticated `GET /api/career/jobs` using the existing session and no-store API responses. User identity always comes from the session; callers cannot request another user's evidence. Database failures return the existing Arena error envelope and a retry/sign-in UI, without falling back to invented user skills.

The service selects distinct skill names from `arena.skill_evidence`, joined to the same user's `weekly_rankings` on review, week, project and user, and only `FINALIZED` weeks. The ranking selects the authoritative final review, so prior review attempts and unselected reruns do not contribute. No new tables or migrations are required.

The catalog is deliberately hardcoded and fictional. UI and API carry **Hardcoded / contoh lowongan — belum terhubung feed lowongan nyata**. Company names explicitly say `fiktif`; there are no application links or invented active openings. Six examples cover data, marketing, design, frontend and operations roles. All cards say they do not accept applications.

Matching is deterministic skill coverage: unique matching required skill names / unique required skill names × 100, rounded to the nearest integer. Names are trimmed and case-insensitive, with no inferred synonyms or skill proficiency claim. Scores are null when the user has no evidence, zero when existing evidence has no overlap, and null for a hypothetical job with no required skills. Ordering uses descending score and stable job ID. The count includes only examples with at least one matching skill. CV scores and review grades are not used. Search (title/company/location/skills), exact employment-type and location filters combine locally; an empty result can reset filters.

`JOBS_PORTAL_URL` is optional server configuration. Missing or invalid values hide the external link. Only HTTPS URLs without embedded credentials are exposed. There is no default URL and no availability claim; a configured link is explicitly described as unverified and opens with `noopener noreferrer` in a new tab. This is a generic portal link, never an application link for fictional examples.

Verification:

- Offline: `node --import ./scripts/node-test-hooks.mjs --test scripts/jobs.test.mjs` (matching, absent evidence, filtering, fictional catalog, safe links).
- Isolated development/test DB fixtures: `node --import ./scripts/node-test-hooks.mjs --test --test-force-exit scripts/jobs-live.test.mjs` (finalization boundary, selected review, user isolation, empty evidence). The fixture uses UUID-scoped records and cleans up only its own IDs; never run against production.
- Browser: authenticated Jobs page loads; search a nonexistent role then reset; combine type/location; inspect null scores for a new user; exercise API error retry and narrow-screen layout.

Remaining owner integration: select and authorize a real Jobs feed/provider and supply any credentials/contract; optionally provide a verified portal URL. Application submission and live-opening availability remain external to this bounded Jobs bridge.
