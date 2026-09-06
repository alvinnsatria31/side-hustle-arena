# Sekolah Karir end-to-end completion

**Goal:** Complete the existing career product locally, preserving the real Arena backend and explicitly identifying integrations that still use sample data.

**Architecture:** Keep Next.js 16 App Router, PostgreSQL/Drizzle, participant authentication and current design system. Career Report reads only the signed-in participant's finalized rankings and review evidence. Jobs computes skill coverage against a clearly labeled sample catalog until a real feed is supplied. Local setup is opt-in and must not weaken production authorization. No deployment, mail or payout is claimed or executed.

**Execution:** User explicitly requests autonomous execution and defers input to the end; assumptions replace the interactive design approval steps. Apply subagent-driven-development for independent tasks. Preserve the existing dirty tree; do not commit unrelated work.

- [ ] Career: implement authenticated report service/API/UI from finalized rankings, evidenced skills and actual points. Test empty state, sealed results, isolation and score trends.
- [ ] Jobs: replace client demo authority and invented match counts with an authenticated service, transparent skill matching, labeled sample catalog and usable filtering.
- [ ] Local operation: provide safe opt-in local bootstrap/login/simulation using existing infrastructure; document exact hardcoded boundaries and reject production usage.
- [ ] CV continuity: inspect scan persistence and connect authenticated scan history to the database if absent.
- [ ] Integration: browser coverage for Career/Jobs and existing flows; typecheck, lint, schema contract and production build. Run DB suites sequentially.
- [ ] Delivery: update README and implementation handoff with implemented/verified/external-pending distinctions and final owner inputs.

## Acceptance checks

`npm run typecheck`, `npm run lint`, `npm run db:check`, and `npm run build` must pass. Focused service tests must exercise actual PostgreSQL fixtures with cleanup. Browser tests must confirm the new pages do not render seeded career achievements as real user data. Production must never accept a development login or deterministic review provider.
