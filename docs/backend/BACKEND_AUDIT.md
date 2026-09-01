# Side Hustle Arena — Backend Audit

## 1. Executive Summary

The repository contains an approved Next.js frontend prototype and no active backend. The working tree is heavily dirty and includes a large, uncommitted frontend rebuild, so it is classified `DANGEROUS/AMBIGUOUS` for integration work even though the shape matches the previous rebuild report.

The frontend builds and passes lint/typecheck. Authentication, persistence, CV analysis, review, points, and submissions are demo-only. There is no database, server API, storage layer, or external Sekolah Karir auth integration. Phase 1 database work is `READY WITH PRECONDITIONS`: first preserve/review the rebuild boundary and confirm the external identity contract.

## 2. Verified Repository Stack

| Capability | Verified state |
|---|---|
| Framework | Next.js 16.3.3, App Router, webpack build |
| UI runtime | React 19.2.0, React DOM 19.2.0 |
| Language | TypeScript 5.7.3, `strict: true` |
| Styling | Tailwind CSS 4.1.18, PostCSS 8.5.1, autoprefixer 10.4.20 |
| Motion/icons | `motion` 13.1.1, `lucide-react` 0.469.0 |
| Runtime checked | Node v24.16.0, npm 11.13.0 |
| Tests | No automated test suite found |
| Build result | `npm run build` passed; 48 routes generated |

## 3. Git / Working Tree Integrity

- Branch: `main`
- HEAD: `fd13711 feat: Sekolah Karir career product frontend (Phase 1)`
- Tracked modified paths: 27
- Tracked deleted paths: 67
- Untracked paths: 44 porcelain entries, including the rebuilt `src` paths, `graphify-out/`, `.gitattributes`, and `docs/`
- Total status entries: 138
- The 67 deletions are the prior `(private)`/legacy route and component architecture. The untracked paths are the replacement `(app)`/`(public)` architecture and new components.
- `package.json` and `package-lock.json` add the `motion` dependency.
- Existing `docs/UI mockups request/` and `graphify-out/` are untracked; they were not modified by this audit.

Classification: `DANGEROUS/AMBIGUOUS`. The state is consistent with the reported uncommitted rebuild, but the rebuild is not committed and there is no safe basis to discard, restore, or merge any of it during Phase 0. No destructive git action was used.

## 4. Route Map

| Route | Source | Current Protection | Current Data Source | Backend Integration Need |
|---|---|---|---|---|
| `/` | `src/app/(public)/page.tsx` | Public | `src/data/mock/arena.ts` | Optional public config/stats |
| `/login` | `src/app/(public)/login/page.tsx` | Public | `DemoProvider` | External Sekolah Karir auth bridge |
| `/cv-scanner`, `/analyzing`, `/result` | `src/app/(public)/cv-scanner/**` | Public | `DemoProvider`, `src/data/mock/cv.ts` | Upload, analysis job, persisted result |
| `/arena` | `src/app/(public)/arena/page.tsx` | Public | `src/data/mock/arena.ts` | Public weekly/project read API |
| `/arena/projects` | `src/app/(public)/arena/projects/page.tsx` | Public | `ProjectBrowser` + mock projects | Project listing/read API |
| `/arena/projects/[slug]` | `src/app/(public)/arena/projects/[slug]/page.tsx` | Public | `src/data/mock/projects.ts` | Published project/read API |
| `/arena/showcase`, `/arena/showcase/[slug]` | `src/app/(public)/arena/showcase/**` | Public | `src/data/mock/showcase.ts` | Published showcase/read API |
| `/app` | `src/app/(app)/app/page.tsx` | None; hydration only | `DemoProvider`, mock projects/report | Authenticated current-user/week API |
| `/app/arena`, `/app/arena/projects`, `/app/arena/projects/[slug]` | `src/app/(app)/app/arena/**` | None | Demo store + mock projects | User-aware project/enrollment API |
| `/app/arena/workspace/[projectId]` | `src/app/(app)/app/arena/workspace/[projectId]/page.tsx` | None; client `belongsHere` check only | Demo store | Authenticated workspace/draft API |
| `/app/arena/submission/[projectId]` | `src/app/(app)/app/arena/submission/[projectId]/page.tsx` | None | Demo store | Submission/version/access/review API |
| `/app/arena/result/[projectId]` | `src/app/(app)/app/arena/result/[projectId]/page.tsx` | None | Demo store + deterministic review | Hidden/final result API |
| `/app/career-report` | `src/app/(app)/app/career-report/page.tsx` | None | `buildCareerReport()` + mock data | Persisted report/read model |
| `/app/jobs` | `src/app/(app)/app/jobs/page.tsx` | None | `src/data/mock/jobs.ts` | Jobs portal/identity bridge |
| `/app/profile` | `src/app/(app)/app/profile/page.tsx` | None | Demo store + `DEMO_USER` | Current user/profile/points API |

The build also exposes loading/error/not-found UI, but no API route or server route handler was found.

## 5. Frontend Data Architecture

`src/features/demo/store.tsx` is the central client context. `DemoProvider` owns a React reducer, exposes `useDemo()`, and persists the complete `DemoState` under `localStorage` key `sk-demo-state-v1`. The state contains a mock user, CV metadata/status, one enrollment, history, proven skills, and career points.

Pages dispatch reducer actions directly for login, CV state, enrollment, workspace drafts/checklists, submission, simulated review, completion, and demo reset. There is no service/API abstraction, server cache, fetch client, server action, or backend response adapter.

Mock datasets are under `src/data/mock/`: projects, Arena constants, CV output, review output, showcase, jobs, and user. `src/features/demo/report.ts` derives a career report from the demo state and mock jobs. `src/features/ui/toast.tsx` provides ephemeral in-memory UI toasts only.

## 6. Demo Store → Future Backend Map

| Current State | Current Location | Future Backend Concept | Migration Complexity |
|---|---|---|---|
| `DemoUser` / `state.user` | `features/demo/store.tsx`, `data/mock/user.ts` | External user identity and server session | High; identity contract unknown |
| `cvScan` metadata/status | Demo store + CV components | CV asset, analysis job, result record | High |
| `recommendedProjectSlug` | Demo store + mock projects | Recommendation/read model | Medium |
| Single `enrollment` | Demo store, workspace routes | User/week enrollment with unique `(user_id, week_id)` | High |
| Plan, notes, checklist | Demo store/workspace | Draft workspace persistence | Medium |
| `Submission` | `types/project.ts` | Logical submission plus immutable versions/items | High |
| `ReviewResult` | `data/mock/review.ts` | Async review job and persisted rubric result | High |
| `completedHistory` | Demo store/report builder | Finalized leaderboard/result history | High |
| `careerPoints` | Demo store | Arena points account and immutable ledger | High |
| `mockSpotlight` / `WEEK_HISTORY` | `data/mock/showcase.ts` | Published showcase/content read model | Medium |
| `MOCK_JOB_MATCHES` | `data/mock/jobs.ts` | Jobs service or portal bridge | Medium |

## 7. Existing Server/API Architecture

No `src/app/**/route.ts`, server action, `src/server`, `src/db`, API client, middleware, or proxy implementation was found. All current page behavior is client-side or statically generated from mock data. No server trust boundary exists to reuse.

Safe reuse is limited to UI-facing types and component boundaries after their contracts are adapted. The demo reducer and mock data are migration seams, not production server code.

## 8. Authentication Audit

### Current auth state

Authentication is `MOCK ONLY`. The app has no identity verification, session cookie, JWT, OAuth callback, or server-side user lookup.

### Login implementation

`/login` renders email/password fields but accepts any values. Submit calls `login()`, which inserts `DEMO_USER` into React state and routes to `/app`. `LoginModal` does the same without credentials. The UI explicitly says no credentials are sent to a server.

### Route protection

`src/app/(app)/layout.tsx` checks only `hydrated` and renders `AppChrome`. It does not redirect unauthenticated users. `/app` routes can be entered directly without server authentication; the client falls back to `DEMO_USER` in several screens.

### Session architecture

The whole demo state, including `user`, is serialized to browser `localStorage`. This is client state, not a secure session. There is no `getCurrentUser` equivalent, cookie handling, token validation, role/permission enforcement, or stable user ID.

### Existing Sekolah Karir auth integration evidence

Only branding, a mock `@sekolahkarir.id` email, copy referring to Sekolah Karir, and `https://jobs.sekolahkarir.id` are present. No auth endpoint, shared cookie, OAuth configuration, user-ID claim, or service contract is present.

### Immutable user ID availability

None. `DemoUser` has name, display name, email, and initials only.

### Subdomain readiness

No code references `arena.sekolahkarir.id`, shared parent-domain cookies, origin allowlists, CORS, callback URLs, or cross-subdomain session handling. Readiness is unknown until the existing Sekolah Karir auth owner provides the contract.

### `arena.sekolahkarir.id` recommendation

Treat Arena as a relying-party frontend/backend that consumes the canonical Sekolah Karir identity. Do not create a second Arena password system. Confirm cookie scope, redirect/callback flow, immutable external ID, logout semantics, roles, and local development behavior before implementation.

### Auth integration category

`MOCK ONLY` currently; production integration will require a bridge.

## 9. Database Audit

### Existing DB code

None found in the current source tree.

### Existing ORM

None. No Drizzle, Prisma, Postgres, `pg`, Neon, Supabase, or database package is declared.

### Existing migrations

None found.

### Active vs legacy/dormant code

Current database code: `NONE`. The tracked HEAD contains the old frontend architecture, not an active database implementation. No dormant database schema was found in the current tree.

### Compatibility with PostgreSQL + Drizzle

No current conflict was observed. Phase 1 can introduce a clean database boundary after identity, week, and ownership rules are confirmed.

## 10. Environment Configuration

No `.env.example`, `.env.local.example`, config schema, or `process.env` reference was found. No current environment variable names are therefore verified.

Likely future names, to be defined only in a later phase, include `DATABASE_URL`, `AUTH_*`, storage credentials such as `R2_*`/`S3_*`, queue credentials such as `UPSTASH_*`, and service authentication such as `INTERNAL_AUTOMATION_*`. No values were read or printed.

## 11. Upload / Storage Audit

CV selection uses a browser `File` and validates extension/size locally (`PDF`/`DOCX`, 5 MB). The component stores only `name` and `size` in the demo state; no file bytes leave the browser. There is no `FormData`, multipart endpoint, presigned URL, private bucket, R2/S3 integration, or server upload.

Arena submission currently supports one URL, explanation text, and notes. URL validation is client-side and checks only that the parsed protocol is `http:` or `https:`. There are no submission files, multiple links, server access checks, or storage records. The final product's 5-file/5-link/20 MB limits are not implemented.

## 12. Submission Gap Analysis

| Requirement | Current | Status | Later Work |
|---|---|---|---|
| Save Draft | Plan/notes/checklist in reducer; localStorage | PARTIAL | Persist authenticated draft server-side |
| Unlimited draft editing | No server or lifecycle limit | PARTIAL | Allow edits without review attempt consumption |
| Project-specific requirements | Static project deliverables/checklists | PARTIAL | Backend-owned requirement schema/read model |
| Explanation | One text field | EXISTS | Persist per version |
| Notes | Workspace notes and submission field | PARTIAL | Persist and expose in version model |
| Multiple files | None | MISSING | Private object storage + file items |
| Multiple links | One URL | CONFLICT | Link-item collection with safe URL policy |
| 20 MB file concept | Only CV has 5 MB client limit | MISSING | Server-side size/MIME policy |
| Access checking | Text says “validating link”; no actual check | MISSING | Async access validation and retryable failure |
| Inaccessible-link state | None | MISSING | `NEEDS_ATTENTION`-style state, without attempt consumption |
| Submission versions | One mutable `Submission` object | CONFLICT | Immutable V1/V2/V3 records |
| Submit | Client reducer action | PARTIAL | Authenticated command with deadline enforcement |
| Resubmit | No separate action or version | MISSING | Up to 3 valid reviewed attempts |
| 3 valid reviewed submissions | None | MISSING | Server count of valid reviewed attempts |
| Technical failure not consuming attempt | None | MISSING | Separate access-check outcome from review attempt |
| Friday lock | Static label only | MISSING | Asia/Jakarta server-side deadline gate |
| Final submission timestamp | One client timestamp | CONFLICT | Final valid version timestamp for tie-break |

## 13. Review Pipeline Gap Analysis

The simulated pipeline lives in `src/features/demo/store.tsx`. `useDemoReviewTicker()` dispatches `REVIEW_TICK` every two seconds while the status is `submitted` or `under_review`. After 6 seconds the status becomes `under_review`; after 20 seconds it becomes `review_ready` and `buildReviewResult()` creates a deterministic rubric score.

The result is then visible to the user immediately, and opening the result page dispatches `COMPLETE_PROJECT`. Completion copies the score into history, adds skills, and credits `review.pointsEarned`. This is legacy mock behavior. The result page must not be treated as the production review source of truth.

Future ownership map:

- mock timer → asynchronous review/access-check job
- mock score → persisted review and rubric result
- immediate result → `REVIEWED_HIDDEN` until Friday finalization/publication
- completion-time points → weekly ranking finalization and points ledger

The literal `+120 points` is not a fixed global rule in current code; the current equivalent is `project.points` (80–180 in the mock set), with the featured project currently displaying 120. Both are legacy mock behavior.

## 14. Leaderboard Gap Analysis

There is no leaderboard route, query, ranking model, or tie-break implementation. Public Showcase uses `mockSpotlight` and `WEEK_HISTORY` to present editorial weekly winners and scores. It is not a global weekly leaderboard and must not be used as one.

Future work needs a global cross-division result ordered by `final_score DESC, final_submitted_at ASC`, with finalized versions only. The current UI has no rank, finalization, or #1/#2/#3/#4+ point distribution state.

## 15. Points & Rewards Gap Analysis

Current `careerPoints` is seeded at 320 in localStorage and increases when the user opens a mock result and `COMPLETE_PROJECT` runs. Profile and Career Report display the balance. There is no immutable ledger, idempotency, expiry policy, or server authority.

There is no current rewards route, catalog, inventory, redemption, or redemption history. The old HEAD contains a deleted `src/data/mock/rewards.ts`, but it is not part of the active working-tree architecture. Future UI must support balance, history, catalog, inventory/locked state, confirmation, and redemption history. The confirmed reward is 2,000 Arena Points → USD 20 with limited inventory; there is no fixed point/USD conversion.

## 16. Notification Gap Analysis

`ToastProvider` supplies one ephemeral in-memory toast. There is no bell, notification list, durable badge, push, email, WhatsApp, or Discord integration. Future events include `PROJECT_DROP`, `DEADLINE_REMINDER`, `SUBMISSION_RECEIVED`, `SUBMISSION_ACCESS_FAILED`, `RESULT_READY`, `POINTS_AWARDED`, `REWARD_REDEEMED`, and `REWARD_FULFILLED`.

## 17. Security Surface

### Critical

No Critical findings observed in this static review. No secret-like files, API keys, database credentials, HTML injection sink, command execution, or server-side database boundary was found.

### High

- `/app` routes have no server authentication or authorization. A user can enter them directly, and the client falls back to demo identity.
- Client localStorage/reducer state is the source of truth for enrollment, submission, review status, score, skills, and points. A user can alter or replay those values locally. This is acceptable only as prototype behavior; it is unsafe as a production trust boundary.
- Dynamic workspace/submission/result access is protected only by client-side `belongsHere` checks. The eventual server must enforce ownership and week scope to prevent BOLA/IDOR.

### Medium

- Submission URLs are user-controlled and validated only for `http:`/`https:`. The current app does not fetch them, so no current SSRF was observed; any future server access checker must block localhost/private IPs, unsafe redirects, and internal metadata targets.
- File validation is client-only for the CV and does not inspect content. Future uploads need server-side MIME/content, size, extension, malware, and private-storage controls.

### Low

No additional concrete Low-severity vulnerability was observed. External links inspected for the jobs portal use `noopener noreferrer`.

### Informational

- No secrets or `NEXT_PUBLIC_*` values were found.
- Mock identity and scores are hard-coded by design.
- No dependency CVE audit tool was run; package versions were inspected only, per the no-install/no-network audit boundary.

## 18. Frontend Preservation Map

### Visually Frozen

All approved public/app route layouts, navigation, typography, styling, animations, responsive behavior, and shared UI components under `src/components/`.

### Data Wiring Only

`src/features/demo/store.tsx`, `src/features/demo/report.ts`, `src/data/mock/*`, and the existing pages that consume them. Replace data/actions behind stable component-facing boundaries without redesigning the approved UI.

### New Product States

Access checking, retryable inaccessible links, immutable submission versions, review-attempt count, queued/under-review/hidden-review states, Friday closed/finalizing, result-ready, and final leaderboard eligibility.

### Potential New Routes/Components

A global weekly leaderboard and rewards/catalog/redemption surfaces are not present. Notification history and durable point history may also need new screens. Add only when product scope requires them.

### Refactor Candidates

The demo store is the primary technical seam for a service abstraction. No refactor should be made in Phase 0; introduce an API adapter incrementally in the implementation phase.

## 19. Dependency Assessment

| Capability | Existing Package | Recommended Later Action |
|---|---|---|
| Drizzle ORM | Not installed | Add during Phase 1 schema work |
| drizzle-kit | Not installed | Add with migration workflow during Phase 1 |
| Neon/Postgres driver | Not installed | Select and add after deployment/runtime decision |
| Zod | Not installed | Add for server/API boundary validation |
| R2/S3 SDK | Not installed | Add only when private uploads are scoped |
| Upstash Redis client | Not installed | Add only if queue/rate-limit design needs it |
| Auth integration | No auth package | Reuse/bridge Sekolah Karir canonical auth; do not add a second identity system without contract review |
| Motion/UI packages | `motion`, `lucide-react` installed | Preserve; unrelated to backend foundation |

## 20. Phase 1 Preconditions

1. Preserve the current dirty rebuild and obtain an explicit review/commit boundary before database work.
2. Obtain the Sekolah Karir auth contract: immutable ID, session/cookie or token model, callback/logout behavior, roles, and subdomain policy.
3. Confirm the canonical week identity, Asia/Jakarta deadline semantics, project publication states, and admin/automation ownership.
4. Decide local environment and migration ownership without connecting to a remote database in this phase.
5. Keep frontend visuals frozen and define the first service boundary that will replace `DemoProvider` reads/actions.

## 21. Phase 1 Recommended Scope

Keep Phase 1 narrowly focused on PostgreSQL/Neon-compatible database foundation: Drizzle configuration, local-safe connection abstraction, migration workflow, and base tables/constraints for external users, weeks, projects, and one enrollment per user/week. Do not implement production auth, uploads, review workers, rewards, automation, VPS access, or frontend redesign in Phase 1 unless separately approved.

## 22. Files Next Agent Should Read

1. `package.json`
2. `src/features/demo/store.tsx`
3. `src/types/project.ts`
4. `src/types/user.ts`
5. `src/types/report.ts`
6. `src/data/mock/projects.ts`
7. `src/data/mock/arena.ts`
8. `src/data/mock/review.ts`
9. `src/app/(app)/layout.tsx`
10. `src/app/(app)/app/arena/workspace/[projectId]/page.tsx`
11. `src/app/(app)/app/arena/submission/[projectId]/page.tsx`
12. `src/app/(app)/app/arena/result/[projectId]/page.tsx`
13. `src/app/(public)/login/page.tsx`
14. `src/components/layout/LoginModal.tsx`
15. `README.md`

## 23. Do-Not-Touch Areas

- Do not reset, restore, clean, revert, commit, or discard the current dirty rebuild without explicit instruction.
- Do not redesign approved layouts, styling, animations, responsive behavior, typography, routes, or shared components.
- Do not treat demo state, immediate review results, mock points, or Showcase data as production rules.
- Do not connect to a remote database, access the VPS, install packages, deploy, or modify external automation.
- Do not print or inspect secret values.

## 24. Unknowns

The canonical Sekolah Karir auth/session contract, immutable external user ID, cross-subdomain cookie policy, user role model, production database owner, storage provider, review queue/AI provider, automation service authentication, jobs API contract, project approval workflow, week ID/timezone source, exact rubric normalization, reward inventory/fulfillment process, and notification delivery ownership are unknown.

## 25. Phase 1 Readiness

`READY WITH PRECONDITIONS`.

There is no backend or database blocking a clean foundation, and the current frontend has an identifiable mock-to-service seam. The uncommitted rebuild and missing canonical auth contract are material preconditions: resolve the repository ownership boundary and confirm identity/session semantics before creating production tables or integration code.
