# Jobs implementation

> **Rewritten 8 September 2026.** The previous version of this document
> described a deliberately hardcoded catalog of six fictional openings. That
> catalog no longer exists: the server module holding it was deleted, and Jobs
> now reads real openings ingested from configured providers. For how to connect
> one, and for operations, see [`JOBS_PIPELINE.md`](./JOBS_PIPELINE.md); this
> document covers the product behaviour a reader of the page sees.

## What the page serves

`/app/jobs` reads authenticated `GET /api/career/jobs` with the existing session
and no-store responses. Identity always comes from the session; a caller cannot
request another user's evidence. A database failure returns the Arena error
envelope and a retry / sign-in UI, and never falls back to invented openings.

Only openings that are `OPEN` **and** belong to an active source reach a
participant, capped at 200 and ordered newest-posted first. Expired, stale and
closed openings stay in the database for history and for the admin view; they
are never shown as if they were live.

Each card carries its provenance: the source's name, its health, and how long
ago that source last synced successfully. An outbound application link goes to
the provider (`https`, `noopener noreferrer nofollow`, new tab) — applications
are not accepted in Arena and the page says so.

When no source is connected the page is honestly empty and explains that,
rather than showing sample data.

## Which skills count as evidence

Distinct skills from `arena.skill_evidence`, joined to the same user's
`weekly_rankings` on review, week, project and user, restricted to `FINALIZED`
weeks. The ranking selects the authoritative final review, so prior attempts and
unselected reruns do not contribute. **CV claims are excluded**: a CV is what
someone says about themselves, and Jobs coverage is built only from reviewed,
finalized work.

## How coverage is computed

Matching compares **taxonomy skill IDs**, not strings. A provider's "MS Excel"
and Arena's "Excel" are one skill; the shared index
(`src/server/career/skill-taxonomy.ts`, built from `arena.skills` plus curated
`arena.skill_aliases`) is what makes that true, and the same index serves the
Career Report and CV matching.

Score = required skills with finalized evidence ÷ required skills that resolved
to the taxonomy × 100, rounded. A role stating no required skills falls back to
its preferred ones. Ordering is descending score, ties broken by id.

Three cases deliberately produce **no score** rather than a number:

| Case | Shown as | Why |
|---|---|---|
| The role listed no skills we could map | *Skill tidak disebut* | There is nothing to compare against. |
| The participant has no finalized evidence | *Belum ada bukti* | `0%` reads as "you match nothing", which is a different claim. |
| Some provider skills did not resolve | Score, **plus** the unmapped names listed | The number is honest about what it covers instead of silently counting them as misses. |

The page states the formula, and states that this is skill coverage — not a
hiring probability, not a readiness score, and not a claim about proficiency.

## Filters

Search (title, company, location, mapped and unmapped skill names), employment
type, work mode and location, combined locally over what the API returned. An
empty result offers a filter reset. Filter options are derived from the data
present, so a filter can never offer a value nothing has.

`UNSPECIFIED` is a real option, not a tidied-away default: a feed that did not
say whether a role is remote must not be presented as on-site.

## Configuration

`JOBS_PORTAL_URL` remains optional: an external careers portal link, HTTPS only,
no embedded credentials, no default, explicitly described as unverified. It is a
generic portal link and never an application link for a specific opening.

## Tests

`scripts/jobs.test.mjs` (offline), `scripts/jobs-pipeline-integration.test.mjs`
(sandbox database, including the API routes), and `e2e-local/career.spec.ts`
(browser).
