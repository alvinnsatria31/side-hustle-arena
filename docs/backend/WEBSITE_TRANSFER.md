# Website → Arena Transfer Record

Source repo: `sekolah-karir-website` (live main site + frozen Arena backup).
Target repo: `side-hustle-arena` (this repo, PRD-driven v2).
Date: 2026-09-04. Rule: transfer only what fits the PRD and the existing
Drizzle/Neon architecture without forcing a redesign.

## Transferred

| Website source | Arena destination | PRD basis |
|---|---|---|
| `src/lib/feature-flags.ts` + `feature_flags` table | `src/server/db/schema/ops.ts`, `src/server/ops/feature-flags(-core).ts`, migration `0003`, wired into enrollment + 4 submission writes | §37 Admin ops, §49 incident handling (pause publish, hold project, emergency close) |
| `src/lib/avatars.ts` | `src/lib/avatars.ts` (verbatim, pure) | §33 leaderboard display identity |
| `src/lib/username-guard.ts` | `src/lib/usernames.ts` (verbatim, pure) | §33 leaderboard handles |
| `src/lib/format.ts` (`formatRupiah`, `formatPostedAt`) | appended to `src/lib/format.ts` | §35–36 reward/notification display |
| `prisma/seed.ts` `seedArenaRewards()` | `scripts/seed-rewards-catalog.mjs` + `GET /api/arena/rewards/catalog` via `src/server/rewards/catalog-service.ts` | §35 rewards (read-only; redemption = Phase 7) |

Adaptations made during transfer:
- Feature-flag keys re-keyed from site features (`program`, `workshop`, …) to Arena ops keys (`arena-enrollment`, `arena-submissions`, `arena-publish`, `rewards-redemption`).
- New `FEATURE_CLOSED` (503) domain error; fail-open-on-DB-error semantics preserved exactly.
- Pure logic split into `*-core.ts` modules (no `server-only`) following the existing `config-core.ts` pattern, so offline `node --test` suites stay green.
- Rewards seed: only the PRD-locked SKU (`2,000 pts → USD 20`, LIMITED) is active; the five website SKUs seed as inactive proposals because the points/XP economy merge is still a pending PO decision.
- Storage direction changed per owner decision: Tencent Cloud COS (S3-compatible) replaces both R2 and the PRD's Alibaba OSS text. `R2_*` env names are a transitional fallback only.

## Deliberately NOT transferred

| Website module | Reason |
|---|---|
| OTP auth (`otp.ts`, `participant-session.ts`, `auth.ts`) | Conflicts with the existing SSO bridge (`users.auth_subject` + PKCE + opaque session). Merging passwordless OTP needs an explicit PO identity decision — must not be smuggled in as a transfer. |
| Payments/QRIS (`payments/`, checkout, vouchers) | Out of Arena scope; lives correctly on the main site. |
| `jobs-portal.ts` / jobs module | PRD §64: Jobs integration is future and must not block Arena launch. |
| `arena-gate.ts`, `gated-routes.ts`, LoginWall copy | Frontend still runs on `DemoProvider` mocks; gate copy belongs to Phase 9 (real-backend wiring), not now. |
| `arena.ts` quest logic, weekly quests seed | Superseded by the Arena week/project/enrollment model already implemented here. |

## Verification

- `npm run typecheck`, `npm run lint` — clean.
- `npm run test:website:transfer` — 6/6 (avatars, usernames, cooldown, formatters, server-only boundary, flag resolver).
- `npm run test:arena:submissions` — 7/7 including live dev schema constraints.
- Migration `0003` applied to dev Neon; `npm run db:seed:rewards` → 6 SKUs; `npm run db:check` contract passed.
