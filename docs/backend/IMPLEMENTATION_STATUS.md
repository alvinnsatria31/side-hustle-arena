# Side Hustle Arena — Backend Implementation Status

> **Diperiksa:** 5 September 2026 · **HEAD:** `8c938d7` · 24 commit di `main`
>
> **Fase berjalan:** Phase 9c — alur peserta tuntas di browser; menyambungkan reviewer AI sungguhan adalah pekerjaan berikutnya.
>
> **Arsitektur terkunci:** Vercel (deploy) + Tencent Cloud COS (byte file, S3-compatible, bucket privat) + Neon PostgreSQL (seluruh teks/metadata/state). Nama R2 tersisa hanya sebagai fallback lokal transisional; arah PRD §18 (Alibaba OSS) sudah digantikan.

## Ringkasan: sudah dan belum

### Sudah, dan terbukti

- [x] **Alur peserta utuh di browser sungguhan** — 9 langkah hijau di `test:e2e:browser`: lihat project → enroll → workspace → tolak file terlarang → upload file nyata ke Tencent COS → tambah link → submit → unduh hasilnya. Ini pertama kalinya alur ini diuji lewat browser, bukan hanya lewat service.
- [x] **Login memakai sesi peserta Sekolah Karir** (`sk_participant`, HS256, `SESSION_SECRET` bersama). Lihat [PARTICIPANT_SESSION.md](./PARTICIPANT_SESSION.md).
- [x] **CORS bucket aktif** — preflight `PUT` dari browser dijawab `200` dengan `Access-Control-Allow-Origin`. Sebelumnya `403` tanpa header, yang membuat upload mustahil dari halaman manapun.
- [x] **Berkas terunduh dengan nama aslinya** — nama dikirim lewat `Content-Disposition` dari object storage, karena browser mengabaikan atribut `download` untuk URL lintas-origin.
- [x] **Penjadwal siklus mingguan** — close, finalisasi, flush email, bersih-bersih sesi (`vercel.json` + `/api/cron/[job]`, auth fail-closed).
- [x] Fondasi frontend, database + migrasi, jembatan auth + hardening, Arena core (week/project/enrollment/workspace), submission (draft, versi immutable, jatah 3× review), penyimpanan privat COS, pertahanan IDOR/SSRF/race/deadline.

### Sudah di backend, belum ada UI-nya

- [ ] Pipeline review (validator, scorer, second judge) — lengkap dan teruji, **tetapi provider aktifnya masih `stub-dev-v1`**
- [ ] Finalisasi, ranking, poin, void/reversal — bekerja penuh di service, belum punya permukaan admin
- [ ] Notifikasi, rewards/milestone, admin ops, hook VPS — API tersedia dan teruji, belum tersambung ke halaman manapun

### Belum dibangun

- [ ] **Reviewer AI sungguhan** — provider, ekstraksi artefak, worker produksi. Prioritas nomor satu: alur peserta sudah utuh, jadi membuka Arena sekarang berarti peserta mengumpulkan kerja nyata dan menerima skor palsu.
- [ ] **Generator project mingguan** — generator, validator, anti-duplikat, fallback library, auto-publish. Cron-nya sudah menunggu dan melapor setiap Senin bahwa generatornya belum ada.
- [ ] UI leaderboard, inbox notifikasi, dan alur redeem reward
- [ ] Dashboard admin dan model peran
- [ ] Halaman yang masih memakai data palsu: homepage Arena privat, showcase publik, CV Scanner, Career Report, Jobs
- [ ] Kontrak voucher ke situs utama (`MAIN_SITE_VOUCHER_TOKEN`)
- [ ] Validasi isi file lewat magic bytes (saat ini masih berbasis MIME + ekstensi)
- [ ] Pembersih upload intent dan objek yatim di bucket
- [ ] Rate limiting auth terdistribusi, termasuk prefix cookie `__Host-`
- [ ] CI/CD, monitoring, alert, backup/recovery

### Menunggu tindakan di luar repo ini

- [ ] Project Vercel + DNS `arena.sekolahkarir.id` (satu CNAME ke Vercel; VPS Biznet tidak perlu menanggung apa pun)
- [ ] Database production, migrasi yang ditinjau, backup, dan seluruh secret production
- [ ] `SESSION_SECRET` dan `COOKIE_DOMAIN` disamakan persis dengan situs utama — kalau meleset, setiap pengunjung terbaca belum login

## Status test

Seluruhnya dijalankan pada 5 September 2026 terhadap database development dan bucket COS yang sebenarnya.

| Suite | Lolos | Catatan |
|---|---|---|
| `test:e2e:browser` | 9/9 | Alur Arena di browser sungguhan; 5 placeholder di-skip |
| `test:arena:core` | 9/9 | |
| `test:arena:submissions` | 10/10 | |
| `test:phase4s:attack` | 7/7 | IDOR, deadline, race, immutability |
| `test:e2e:upload` | 4/4 | |
| `test:e2e:storage` | 2/2 | Roundtrip COS live |
| `test:e2e:flow` | 1/1 | |
| `test:e2e:reviews` | 1/1 | |
| `test:e2e:finalize` | 1/1 | |
| `test:auth:participant` | 5/5 | Verifikasi cookie, forgery, suspend |
| `test:scheduler` | 3/3 | |
| `test:reviews:pipeline` | 10/10 | |
| `test:vps:automation` | 6/6 | |
| `test:finalize:ranking` | 4/4 | |
| `test:website:transfer` | 6/6 | |
| `test:db:local` | 1/1 | |
| `auth-security` | 7/7 | Dijalankan via `node --test`, belum punya npm script |
| `test:sso:local` | 1/9 | **Dorman** — menguji jembatan SSO yang tidak lagi dipakai untuk login |

`test:e2e:browser` dan QA manual tidak bisa berjalan bersamaan: aplikasi hanya mengenal satu week aktif, jadi fixture QA merebutnya. Suite akan berhenti dengan pesan yang menyebut penyebabnya.

## Dua temuan yang mengubah rencana

**Arena sudah hidup di `arena.sekolahkarir.id` sejak 9 Agustus 2026** — aplikasi terpisah di Cloudflare Workers dengan database D1 sendiri. Jadi ini penggantian, bukan peluncuran baru. `/arena` dan `/arena/enter` di `sekolah-karir-website` adalah etalase dan pintu masuknya (termasuk perbaikan cakupan cookie), **bukan sisa yang layak dihapus**.

**Situs utama tidak punya endpoint SSO sama sekali** — tidak ada `/api/sso/`. Itulah sebabnya `SK_AUTH_ORIGIN` selalu menolak koneksi selama pengembangan: bukan servernya mati, melainkan loketnya memang belum pernah dibangun. Login karena itu memakai cookie bersama, sama seperti Arena yang sekarang berjalan. Jembatan SSO tetap disimpan sebagai jalur upgrade.

---

Bagian di bawah ini adalah catatan per fase, disimpan sebagai riwayat.

> **Previous Phase:** Phase 4 - Arena Submission System + Private Object Storage.

> The older Phase 3 header below is retained as historical context and is superseded by this Phase 4 status.

> **Current Phase:** Phase 3 — Arena Core API Implementation.
>
> **Status:** COMPLETE — current-week, visible-project, enrollment, workspace, and development seed quality gates passed. The checkpoint remains local; production hardening and deployment remain out of scope.

## Current Phase

PHASE 2E — Development Database Bring-Up + DB-Backed SSO Integration

## Status

COMPLETE - isolated development migrations and localhost DB-backed SSO verification passed. Production hardening and deployment remain out of scope.

## Phase 9a - Public frontend wiring (PRD §56)

- `src/lib/arena-view.ts`: server-only read seam (services → view models). `/arena`, `/arena/projects`, `/arena/projects/[slug]` live on Neon data.
- Mock-only numbers removed, not faked: per-project points/participant counters gone from public UI (PRD: points come from ranks).
- Components accept live props with mock defaults: `(app)` demo screens untouched; `CtaActions` enroll write deferred to 9b.
- Contract: `docs/backend/FRONTEND_WIRING_9A.md` (mappings, verified pages, known 404-status issue).
- Quality gates: typecheck, lint, production build, HTTP verification (live stats/kanban/browse/detail, branded 404 UI).

## Phase 8.5 - VPS Automation Full Port (website n8n + milestones + voucher + email)

- Milestone ladder on lifetime points (computed, never stored) + take flow (PENDING redemption + notice) + crossing nudges in finalize. Steps = active catalog SKUs.
- Outbound n8n hooks (`arena-submit` wired via `after()`, publish/generator points reserved), best-effort with loud skip when unconfigured.
- Eval ingest (`/api/webhooks/arena-eval`, separate bearer): external graders use the same lease pipeline; no PENDING job → deduped, never double-scores.
- Voucher push interface ready, reports contract-pending until main-site agreement. Email flush live; sends only with `RESEND_API_KEY`, else PENDING (never fake-sent).
- Contract: `docs/backend/VPS_AUTOMATION.md` (incl. 5 VPS-side ops items).
- Quality gates: `test:vps:automation` (6/6), extended `test:e2e:reviews` (ingest + dedupe) and `test:e2e:finalize` (150-pt SKU → nudges → take → double-take refused → voucher pending), typecheck, lint, build.

## Phase 8 - Notifications + Admin backend (PRD §36, §37, §46)

- Migration `0005_happy_silver_fox.sql` applied to dev: `events.read_at` + inbox index.
- `src/server/notifications/`: durable events + IN_APP deliveries, best-effort triggers (submit RECEIVED/ACCESS_FAILED, finalize RESULT_READY/POINTS_AWARDED), scheduler broadcast endpoint, session-scoped inbox + unread + read APIs.
- `src/server/admin/overview.ts`: one-call ops overview (week, counts, queue, NEEDS_RESOLUTION backlog, flags, catalog, redemptions, audit) + audited flag flips.
- Routes: `GET|POST /api/arena/notifications`, `GET /api/internal/admin/overview`, `POST /api/internal/admin/flags`, `POST /api/internal/notifications/broadcast`.
- Contract: `docs/backend/NOTIFICATIONS_ADMIN.md` (incl. PRD §37 coverage map).
- Quality gates: extended `test:e2e:flow` (submit inbox trace) + `test:e2e:finalize` (inbox per racer, read/unread, overview, flag audit), typecheck, lint, build.

## Phase 7 - Finalization + Leaderboard + Points (PRD §32–34, §62)

- `src/server/finalization/`: pure ranking (`ranking.ts`: score DESC, time ASC, userId ASC; 300/200/150/100), `service.ts` (close/finalize/void), `leaderboard-service.ts` (FINALIZED-only public board).
- Close is deadline-gated with audited `force` escape hatch; finalize is fail-closed (no open jobs, no NEEDS_RESOLUTION) and idempotent (rankings upsert, ledger `finalize:<week>:<user>` on-conflict-do-nothing, accounts move only on new rows).
- Void separates scoring from eligibility: score rows preserved, ranking removed, points revoked via negative `ADMIN_REVERSAL` ledger entry.
- Routes: `GET /api/arena/leaderboard`, `POST /api/internal/weeks/[action]` (close/finalize), `POST /api/internal/enrollments/[id]/void`. Friday scheduler stays future work.
- Contract: `docs/backend/FINALIZATION.md`.
- Quality gates: `test:finalize:ranking` (4/4), `test:e2e:finalize` live (3 racers → close → WEEK_NOT_READY while jobs open → drain → finalize → 300/200/150 → idempotent repeat → void + reversal → zero residue), typecheck, lint, build.

## Phase 6 - AI Review Pipeline (PRD §20, §24–31, §42–43, §45, §47)

- Migration `0004_melted_golden_guardian.sql` applied to dev: `reviews.run_number` + unique(version, run) for audited reruns, `review_status += NEEDS_RESOLUTION`.
- `submitArenaSubmission` enqueues one PENDING review job per ACCESSIBLE version inside the same transaction (FAILED-access versions queue nothing, consume nothing).
- Worker API (`src/server/reviews/`, routes `/api/internal/reviews/claim|complete|fail`, `admin/[action]`), bearer-gated by `INTERNAL_AUTOMATION_TOKEN` (fail-closed).
- Blind reviewer input (no previous scores), structured output contract, validator (evidence-required, hallucination-rejecting), backend weighted scorer, second-judge routing (confidence < 0.70 / warnings / unextracted files; disagreement ≥ 12 → NEEDS_RESOLUTION), post-lock improvement feedback.
- Models via profiles; deterministic `stub-dev-v1` today, OpenAI-compatible interface ready for `AI_API_KEY` provisioning. Local stub worker refuses non-development.
- Admin rerun (new run, old rows preserved) + override (history appended, aiScore untouched), both attempt-free and audited. Append-only audit: ENQUEUED/CLAIMED/COMPLETED/RETRY/FAILED/NEEDS_RESOLUTION/RERUN/OVERRIDE.
- Contract: `docs/backend/REVIEW_PIPELINE.md`.
- Quality gates: `test:reviews:pipeline` (9/9), `test:e2e:reviews` live (submit → queue → claim → stub review → weighted scores → rerun run 2 with judge → override → audit), typecheck, lint, `db:check`.

## Phase 5 - Website Transfer (sekolah-karir-website → side-hustle-arena)

- Source: `sekolah-karir-website` `src/lib/feature-flags.ts`, `avatars.ts`, `username-guard.ts`, `format.ts`, `prisma/seed.ts` (arena rewards). Transfer record: `docs/backend/WEBSITE_TRANSFER.md`.
- `ops.feature_flags` table + migration `0003_careless_invisible_woman.sql` applied to dev. Keys: `arena-enrollment`, `arena-submissions`, `arena-publish`, `rewards-redemption`. Semantics kept identical: missing row = open, failed read = open (fail-open, logged).
- Kill-switches wired into `selectArenaProject`, `patchArenaSubmissionDraft`, `addArenaSubmissionLink`, `createArenaUploadIntent`, `submitArenaSubmission` via `assertArenaFeatureOpen()` → `FEATURE_CLOSED` (503). Admin exemption injected (admin auth still deferred, default non-admin).
- Display identity libs with zero DB dependency: `src/lib/avatars.ts`, `src/lib/usernames.ts`, `formatRupiah`/`formatPostedAt` in `src/lib/format.ts` — reserved for leaderboard/profile wiring (Phase 9).
- Rewards catalog: `npm run db:seed:rewards` upserts 6 SKUs (1 active: PRD-locked 2,000 pts → USD 20 LIMITED; 5 website-proven SKUs inactive pending PO economy decision). Public read: `GET /api/arena/rewards/catalog`. Redemption/ledger remain Phase 7.
- Not transferred (documented with reasons): OTP auth (conflicts with SSO bridge — needs PO decision), payments/QRIS (out of Arena scope), jobs-portal (PRD §64 future, must not block Arena), LoginWall copy (frontend wiring phase).
- Quality gates: typecheck, lint, `test:website:transfer` (6/6), `test:arena:submissions` (7/7 incl. live dev schema), core offline (5/5), `db:check` contract passed. `arena-core-live` still needs a running dev server on :3001 (environmental, pre-existing).

## Phase 4 - Arena Submission System + Private Object Storage

- Status: PARTIAL. Authenticated ownership-scoped submission draft, link, upload-intent/finalize, submit, private-download, and draft-item deletion routes are implemented; the approved frontend remains unchanged.
- Development migration `0002_mysterious_wasp.sql` was generated and applied only to the approved Arena development database. It adds `arena.upload_intents` and a partial unique review-attempt constraint; production migrations remain unapplied.
- Submission records are lazy one-per-enrollment drafts. Every mutable submission operation locks at the deadline, requirements remain persisted/configurable, and immutable versions snapshot submitted draft content.
- Private R2 uses server-only configuration, random environment-scoped keys, short-lived presigned PUT/GET URLs, metadata finalization, and no permanent public URL. The R2 client is development-only in this phase.
- Link checks are SSRF-protected with HTTPS-only validation, DNS resolution/address rejection, connection pinning, redirect revalidation, timeout, and no credential forwarding.
- Non-R2 tests and the live development schema constraint test are verified. Live direct-upload/finalize/download/delete integration is **VERIFIED** against the private Tencent COS bucket (`ap-jakarta`, `npm run test:e2e:storage` 2/2): regional endpoint normalization, short-lived presigned PUT, HEAD size/type check, presigned GET byte verification, delete + gone-proof. Anonymous GET is denied (bucket stays private; verified read-only, no ACL/CORS change). Upload-intent TTL is 600s; keys stay random and environment-scoped.
- Contract: `docs/backend/ARENA_SUBMISSIONS_API.md`.

## Phase 3 - Arena Core API Implementation

- Current week, active division, and visible current published project services and route handlers are implemented.
- Enrollment selection is authenticated, same-origin protected, transactionally validated, and constrained to one project per user/week.
- Workspace progress is ownership-scoped, Zod-bounded, lazily persisted, and deadline-locked.
- Development-only idempotent seed: `npm run db:seed:arena`.
- No migration is required: Phase 1's existing schema contains the needed tables and uniqueness constraint.
- Frontend demo/mock sources remain unchanged; these APIs are not yet wired into the UI.
- Arena quality gates passed: lint, typecheck, production build, static auth regression, live database constraints, Arena core API tests, seed idempotency, migration generation, schema contract, and diff check.
- Contract: `docs/backend/ARENA_CORE_API.md`. Service boundaries: `docs/backend/ARENA_SERVICE_ARCHITECTURE.md`.

## Phase 2E — Development Database Bring-Up + DB-Backed SSO Integration

- Arena migration `0001_pink_khan.sql`: applied only to the approved Arena development database; rerun idempotency and live schema checks passed.
- Canonical migration `0011_cultured_lilandra.sql`: applied only to the existing local Docker PostgreSQL development database; rerun idempotency and live SSO schema checks passed.
- Arena and Canonical migration generation: no schema drift.
- DB-backed localhost SSO: VERIFIED for login, authorization-code exchange, PKCE, state, redirect validation, replay/expiry, JIT provisioning, local session hashing, protected `/app`, logout revocation, suspension rejection, and fail-closed introspection outage behavior.
- Arena live constraints: verified in a rolled-back transaction.
- Retention: cleanup helpers remain explicit maintenance operations; no scheduler or request-path cleanup was added.
- Arena quality gates: lint, typecheck, production build, migration generation, schema contract, static auth tests, local DB constraints, DB-backed SSO suite, outage suite, and diff check passed.
- Canonical quality gates: lint, production build, migration generation, existing login-flow test, and diff check passed. Separate typecheck/test scripts are not available.
- Development database setup: `docs/backend/DEVELOPMENT_DATABASE_SETUP.md`.
- DB-backed evidence: `docs/backend/DB_BACKED_SSO_INTEGRATION_REPORT.md`.
- Production database modified: NO.
- Production migrations applied: NO.
- Runtime production SSO verified: NO.
- Deployment and remote push: NO.
- Next: production-precondition work remains limited to the deferred security items; do not treat Phase 2E as production authorization.

## Phase 2D.1 — Targeted Sol Auth Re-Review

- Arena reviewed baseline: `1ea722c` on `feature/arena-auth-hardening`.
- Canonical reviewed baseline: `21ff365` on `feature/arena-sso-hardening`.
- `SOL-AUTH-001`, `003`, `005`, `006`, and `007`: VERIFIED RESOLVED.
- `SOL-AUTH-002`: OPEN / REQUIRED BEFORE PRODUCTION.
- `SOL-AUTH-004`: OPEN / LOW / DEFENSE IN DEPTH.
- `SOL-AUTH-008`: PARTIAL / cleanup implemented, scheduler pending.
- Critical remaining: 0.
- High remaining: 0.
- Medium remaining: 1.
- Low remaining: 2.
- Security gate: PASS WITH DEFERRED PRODUCTION HARDENING.
- Migration hygiene: VERIFIED / READY for a fresh isolated development database.
- Development DB gate: READY FOR PHASE 2E DEVELOPMENT DATABASE BRING-UP.
- Production authentication gate: NOT YET READY.
- Real DB: NOT CONNECTED.
- Migrations: NOT APPLIED.
- Runtime database-backed SSO: NOT VERIFIED.
- Report: `docs/backend/AUTH_SECURITY_REREVIEW_SOL.md`.
- Next: PHASE 2E — DEVELOPMENT DATABASE BRING-UP + DB-BACKED SSO INTEGRATION.

## Phase 2D - Targeted Auth Hardening

- `SOL-AUTH-001` Canonical login CSRF: RESOLVED with exact Origin, JSON shape, per-login CSRF token, and browser-bound validated continuation.
- `SOL-AUTH-002` distributed rate limiting: OPEN / REQUIRED BEFORE PRODUCTION; deferred to the approved Upstash Redis phase.
- `SOL-AUTH-003` revocation window: RESOLVED; Arena default canonical introspection interval reduced from 300 to 60 seconds with a 30-300 second configuration bound and fail-closed due checks unchanged.
- `SOL-AUTH-005` Canonical logout CSRF: RESOLVED with exact Origin validation while preserving source-session grant revocation.
- `SOL-AUTH-006` login timing: RESOLVED; known and unknown failed logins each perform one bcrypt comparison.
- `SOL-AUTH-007` HTTPS/origin configuration: RESOLVED for production origins and the expected HTTPS Arena callback; development HTTP is localhost-only.
- `SOL-AUTH-008` retention: PARTIAL; explicit cleanup boundaries exist but require a future trusted scheduler.
- Migration hygiene: READY. Canonical 0011 is SSO-only; proposal schema remains in 0010. Review: `docs/backend/PRE_DATABASE_MIGRATION_REVIEW.md`.
- Real DB: NOT CONNECTED.
- Migrations: NOT APPLIED.
- Next: SOL TARGETED RE-REVIEW.

## Phase 2C - Sol Authentication Security Audit

- Arena review commit: `09cc39d`.
- Canonical review commit: `98c325e`.
- Critical findings: 0.
- High findings: 0.
- Medium findings: 3.
- Low findings: 5.
- Informational findings: 2.
- Security gate: PASS WITH REMEDIATIONS.
- Blocking before isolated integration test: NONE (no Critical/High finding).
- Required before production: Canonical login-CSRF protection, auth abuse throttling, explicit resolution of the 300-second revocation/suspension window, and the documented test/deployment preconditions.
- Auth source modified during audit: NO.
- Canonical repository modified during audit: NO.
- Migrations applied: NO.
- Runtime DB-backed SSO verified: NO.
- Next phase: PHASE 2D - TERRA TARGETED AUTH HARDENING.
- Audit report: `docs/backend/AUTH_SECURITY_AUDIT_SOL.md`.
- Remediation plan: `docs/backend/AUTH_REMEDIATION_PLAN.md`.

## Phase 2B - Central Auth Bridge + Arena Server Auth

- Arena migration generated: YES (0001_pink_khan.sql).
- Canonical migration generated: YES (0011_cultured_lilandra.sql).
- Migrations applied: NO.
- Actual SSO runtime verified: NO (no database-backed integration environment was used).
- Arena quality gates: lint, typecheck, build, offline migration generation, auth tests, and diff check passed with explicit process ExitCode 0.
- Canonical quality gates: lint, typecheck, build, auth tests, and diff check passed with explicit process ExitCode 0.
- /app protected server-side: YES.
- Mock auth authoritative: NO; unrelated demo project/workspace state remains mock.
- Admin authorization: DEFERRED / NOT YET MAPPED.
- Phase 2C readiness: READY for authentication/session/authorization security audit.

## Phase 0 - Repository/Auth/Backend Readiness Audit

Status: COMPLETE

The audit established that the approved Next.js frontend was mock-driven, had no server API/auth/database boundary, and required a protected checkpoint before backend work.

## Phase 0.5 - Frontend Baseline Checkpoint

Status: COMPLETE

- Checkpoint commit `36bd42f` was created on `feature/arena-backend-foundation`.
- The approved frontend remains canonical and unchanged.
- Auth remains `MOCK ONLY`.
- Backend work began only after this checkpoint.

## Phase 1 - Database Foundation

Status: COMPLETE - migration generated locally and not applied.

- Dependencies added: `drizzle-orm`, `drizzle-kit`, `postgres`, and `zod`.
- Logical schemas implemented: `identity`, `arena`, `rewards`, `notifications`, `automation`, and `audit`.
- 30 tables, PostgreSQL enums, foreign keys, targeted indexes, and checked/unique constraints are declared under `src/server/db/schema/`.
- Lazy `getDb()` reads `DATABASE_URL` only when used; frontend builds do not require it.
- Migration generated: `drizzle/0000_previous_thing.sql`.
- Migrations applied: NO.
- Real database connected: NO.
- Frontend changed: NO.
- Auth bridge implemented: NO.
- No seed system, R2, Redis, review worker, scheduler, VPS access, or deployment was added.

Next phase recommendation: PHASE 2 - SEKOLAH KARIR AUTH BRIDGE + SERVER AUTHORIZATION FOUNDATION.

## Phase 2A - Auth Contract Discovery

Status: COMPLETE - documentation only.

- Canonical auth location: `D:\Sekolah Karir Workspace`.
- Auth mechanism: custom PostgreSQL-backed bcrypt credentials with opaque database sessions.
- Canonical user identifier: Workspace `users.id` UUID.
- Session cookie: `skw_session`, HttpOnly, SameSite=Lax, Secure when HTTPS, Path `/`, 14-day MaxAge, host-only because Domain is absent.
- Subdomain readiness: no Arena callback, shared parent-domain cookie, or cross-subdomain SSO evidence found.
- Recommended bridge method: central auth redirect plus short-lived one-time authorization-code exchange, followed by an Arena-scoped session.
- `identity.users.auth_subject`: SUFFICIENT AS-IS for canonical subject mapping; no schema change made.
- Phase 2B readiness: READY WITH PRECONDITIONS.
- No source files, packages, environment files, database files, or external repositories were modified.

## Production Hostname

arena.sekolahkarir.id

## Current Frontend Status

Approved Next.js App Router frontend baseline. The UI remains driven by `src/features/demo/store.tsx`, `src/data/mock/*`, and `src/features/demo/report.ts`; no frontend source changed during Phase 1.

## Current Backend Status

No API routes, route handlers, server actions, server services, middleware, proxy, API client, or frontend/backend integration are present. The database client is a server-side foundation only.

## Current Database Status

Drizzle schema and reviewed migrations are now applied only to isolated development targets: the approved Arena development database and the local Canonical Docker PostgreSQL service. No production database was connected or changed.

## Current Auth Status

Arena uses the verified first-party Canonical authorization-code + PKCE bridge in the local development environment. Canonical `users.id` maps to `identity.users.auth_subject`; `skw_session` remains host-only and Arena uses a separate opaque local session. Production authorization remains unverified and undeployed.

## Phase 2A Findings

The real Workspace authentication source is now located and its server contract is documented in `docs/backend/AUTH_CONTRACT_AUDIT.md` and `docs/backend/AUTH_INTEGRATION_CONTRACT.md`. Direct reuse of `skw_session` is not supported by current evidence because the cookie is host-only and Arena has no shared session verifier. Phase 2B must obtain the canonical auth owner’s callback, verification, logout, role, and origin contract before implementation.

## Repository Integrity Status

The approved frontend checkpoint is `36bd42f` on `feature/arena-backend-foundation`. The allowed pre-existing untracked paths remain `.gitattributes`, `docs/UI mockups request/`, and `graphify-out/`; they are excluded from backend work.

## Final Business Rules

- One project maximum per user per week.
- Projects drop Monday; the weekly deadline is Friday 23:59 Asia/Jakarta.
- No late selection, submission, or resubmission.
- Draft editing is unlimited and does not consume a review attempt.
- Maximum 3 valid AI-reviewed submission attempts per project/week.
- Technical access failure does not consume a valid review attempt.
- Review remains hidden until finalization.
- Leaderboard is global: score DESC, then final submit time ASC.
- Rank points are 300, 200, 150, then 100; points never expire.
- A 2,000-point USD 20 reward is a limited SKU, not a conversion rate.
- Existing Sekolah Karir identity must be reused.

## Legacy Mock Behaviors That Must Not Become Backend Rules

- Any-credential login and localStorage authority.
- Client-only URL validation and one mutable URL-only submission.
- Browser review timers, immediate results, client-generated review data, and client point mutation.
- Static week/deadline data, a featured `+120` display, seeded balances, and mock job data.

## Phase 1 Outcome

- `auth_subject` is a neutral immutable external-identity bridge; it is not email and does not create Arena credentials.
- One enrollment per user/week, immutable submission versioning, review/ranking uniqueness, and idempotent financial/automation rows are database-enforced.
- Generated SQL was reviewed for six schemas, enums, UUID defaults, `timestamptz`, foreign keys, indexes, checks, and restrictive history preservation.

## Known Unknowns

Canonical bridge endpoint/code verification; callback/origin allowlists; logout propagation; session invalidation on password change; Arena session persistence; and whether Workspace roles can express Arena administration.

## Recommended Next Phase

PHASE 2D - TERRA TARGETED AUTH HARDENING

Remediate the Medium findings and add the required isolated DB/browser security tests without redesigning the authorization-code, PKCE, host-only-cookie, or local-session architecture. Do not apply either migration to a real database until separately approved.
