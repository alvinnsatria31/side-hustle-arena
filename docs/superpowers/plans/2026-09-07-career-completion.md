# Sekolah Karir end-to-end completion

**Goal:** Complete the existing career product locally, preserving the real Arena backend and explicitly identifying integrations that still use sample data.

**Architecture:** Keep Next.js 16 App Router, PostgreSQL/Drizzle, participant authentication and current design system. Career Report reads only the signed-in participant's finalized rankings and review evidence. Jobs computes skill coverage against a clearly labeled sample catalog until a real feed is supplied. Local setup is opt-in and must not weaken production authorization. No deployment, mail or payout is claimed or executed.

**Execution:** User explicitly requests autonomous execution and defers input to the end; assumptions replace the interactive design approval steps. Apply subagent-driven-development for independent tasks. Preserve the existing dirty tree; do not commit unrelated work.

Status reconciled 7 September 2026 against the tree, not against memory: the
boxes were all empty while most of the work had in fact landed, which the
implementation audit called out. Each tick below names the evidence.

- [x] Career: implement authenticated report service/API/UI from finalized rankings, evidenced skills and actual points. Test empty state, sealed results, isolation and score trends. — `src/server/career/report-service.ts`, `report.ts`; `scripts/career-report.test.mjs` (offline) and `career-report-live.test.mjs` (database).
- [x] Jobs: replace client demo authority and invented match counts with an authenticated service, transparent skill matching, labeled sample catalog and usable filtering. — `src/server/career/jobs-service.ts`, `jobs-matching.ts`, `src/app/api/career/jobs/route.ts`; `scripts/jobs.test.mjs`. The catalog is still the labelled sample (`src/data/mock/jobs.ts`), which this plan explicitly permits "until a real feed is supplied".
- [x] Local operation: provide safe opt-in local bootstrap/login/simulation using existing infrastructure; document exact hardcoded boundaries and reject production usage. — `scripts/local-dev.mjs`, `scripts/local-env.mjs`, `src/server/dev/guard.ts`, the `/dev` fixture routes; refuses anything but a loopback `arena_local` database.
- [x] CV continuity: inspect scan persistence and connect authenticated scan history to the database if absent. — `src/server/cv/history.ts`; `scripts/cv-history.test.mjs`, `cv-history-db.test.mjs`.
- [ ] Integration: browser coverage for Career/Jobs and existing flows; typecheck, lint, schema contract and production build. Run DB suites sequentially. — **Partially done.** Typecheck, lint, `db:check` and `build` pass, and CI now runs them (`.github/workflows/ci.yml`). Browser coverage does NOT include Career or Jobs: `e2e/` holds only `arena-flow`, `avatar-picker` and `public-header`, and `arena-flow.spec.ts:254-256` still carries two `fixme`s (cross-site sign-in, real external AI review).
- [ ] Delivery: update README and implementation handoff with implemented/verified/external-pending distinctions and final owner inputs. — **Partially done.** README rewritten 7 September 2026 (it had still claimed a frontend-only prototype with no backend). The handoff distinctions and the owner's final inputs are open.

## Acceptance checks

`npm run typecheck`, `npm run lint`, `npm run db:check`, and `npm run build` must pass. Focused service tests must exercise actual PostgreSQL fixtures with cleanup. Browser tests must confirm the new pages do not render seeded career achievements as real user data. Production must never accept a development login or deterministic review provider.
