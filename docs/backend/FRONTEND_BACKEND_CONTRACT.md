# Side Hustle Arena — Frontend/Backend Contract

## 1. Contract Principles

### CURRENT FRONTEND

The approved UI is driven by `DemoProvider`, mock datasets, and direct reducer dispatches.

### FUTURE BACKEND NEED

Backend endpoints/services become the source of truth. Replace demo reads/actions incrementally behind a stable service abstraction; do not scatter fetch logic through presentational components. Preserve route names, visuals, loading, error, and responsive behavior.

### LEGACY MOCK BEHAVIOR TO REMOVE

Client localStorage must not remain authoritative for identity, submissions, review, or points.

## 2. Current User

### CURRENT FRONTEND

`DemoUser` has name, display name, email, and initials. `DEMO_USER` is used as a fallback, and login accepts any credentials.

### FUTURE BACKEND NEED

Return the canonical Sekolah Karir immutable user ID, display name, email, avatar/initials if available, roles/permissions, account status, and authenticated session state. Define cookie/token, logout, expiry, and cross-subdomain behavior for `arena.sekolahkarir.id`.

### LEGACY MOCK BEHAVIOR TO REMOVE

Any-credential login, `DEMO_USER` fallback, and client-persisted user state.

## 3. Current Week

### CURRENT FRONTEND

`ARENA_WEEK = 36`, static labels, and `ARENA_DEADLINE = 'Jumat · 21:59'` come from `src/data/mock/arena.ts`. Project records carry a numeric week and static deadline label.

### FUTURE BACKEND NEED

Provide a stable week ID, status (`upcoming`, `open`, `closed`, `finalizing`, `results_ready` or the final agreed names), `opensAt`, exact `deadlineAt` in Asia/Jakarta, server time/countdown inputs, and lock flags. The deadline must be exactly Friday 23:59 Asia/Jakarta and enforced server-side.

### LEGACY MOCK BEHAVIOR TO REMOVE

Static week/deadline labels and the current 21:59 value must not become business rules.

## 4. Projects

### CURRENT FRONTEND

`src/data/mock/projects.ts` contains 12 mock records, including `isThisWeek`, category/group, difficulty, estimated time, points, participants, deliverables, resources, and rubric.

### FUTURE BACKEND NEED

Return published projects for the active week, configurable project counts per division, all supported divisions, comparable difficulty/effort metadata, deliverables, requirements, resources, rubric version, and publication state. Users must be able to choose outside their home division.

### LEGACY MOCK BEHAVIOR TO REMOVE

Hard-coded project arrays, participant counts, recommendation slugs, and per-project point amounts.

## 5. Project Detail

### CURRENT FRONTEND

Public and app detail pages render the same mock project brief and static rubric. CTA behavior dispatches local enrollment or navigates to the demo workspace.

### FUTURE BACKEND NEED

Return a published, immutable project brief by ID/slug, including week, division, difficulty band, requirements, accepted artifacts, rubric version, and availability. Return user-specific enrollment state separately.

### LEGACY MOCK BEHAVIOR TO REMOVE

Static `getProject()` lookup and client-controlled enrollment.

## 6. Enrollment

### CURRENT FRONTEND

`ENROLL` creates one local `ProjectEnrollment`, replacing a finished enrollment. No server constraint exists.

### FUTURE BACKEND NEED

Create/read an enrollment keyed by authenticated user and week, with a server-enforced unique `(user_id, week_id)` constraint, project ID, timestamps, lifecycle state, and deadline eligibility. Selection must be blocked after the weekly close.

### LEGACY MOCK BEHAVIOR TO REMOVE

Starting a new project locally, replacement of an enrollment, and client-only `belongsHere` ownership checks.

## 7. Workspace

### CURRENT FRONTEND

Five steps (`brief`, `plan`, `work`, `review`, `submit`) are rendered in one client page. Plan, tasks, notes, and checklist are stored in the reducer/localStorage.

### FUTURE BACKEND NEED

Read and save drafts by enrollment, support unlimited edits before close, preserve project-specific requirements, and return a version/updated-at value for optimistic concurrency if needed. Draft edits must not create review attempts.

### LEGACY MOCK BEHAVIOR TO REMOVE

Reducer-only persistence and assuming one fixed workspace shape for every project.

## 8. Submission Draft

### CURRENT FRONTEND

The submit step collects one URL, explanation, and notes. Client code validates the URL and dispatches `WS_SUBMIT` after a 1.4-second fake delay.

### FUTURE BACKEND NEED

Support a draft with explanation, notes, multiple file items, multiple safe HTTPS link items, project-specific required items, and explicit submit/resubmit commands. Server validation must enforce ownership, week state, requirements, and limits.

### LEGACY MOCK BEHAVIOR TO REMOVE

Fake submit delay, URL-only shape, client-only validation, and direct reducer mutation.

## 9. Submission Requirements

### CURRENT FRONTEND

Requirements are implied by static deliverables, review checklist, and UI text. No formal schema exists.

### FUTURE BACKEND NEED

Expose typed requirements: required explanation/notes, accepted file MIME families, link types, counts, max file size, and project-specific rules. Initial provisional limits are 5 files, 5 links, and 20 MB per file.

### LEGACY MOCK BEHAVIOR TO REMOVE

The single hard-coded “one public link” assumption.

## 10. Submission Versions

### CURRENT FRONTEND

`Submission` is one mutable object with `url`, `explanation`, `notes`, and `submittedAt`.

### FUTURE BACKEND NEED

Model a logical submission with immutable V1/V2/V3 versions, immutable item references, validation outcome, review-attempt eligibility, and final-submitted timestamp. The latest valid reviewed version at deadline is the leaderboard version.

### LEGACY MOCK BEHAVIOR TO REMOVE

Overwriting one local submission object and using an earlier placeholder timestamp.

## 11. Access Check

### CURRENT FRONTEND

The submit button text says it is validating the link, but no link is opened or checked. The only actual check is client-side URL parsing.

### FUTURE BACKEND NEED

Run a safe access check before queueing review. Return a retryable technical failure for private Drive, inaccessible/broken/missing URLs, or other access errors. Allow correction before the Friday deadline without consuming a valid review attempt.

### LEGACY MOCK BEHAVIOR TO REMOVE

Treating syntactic URL validity as accessible evidence.

## 12. Review Status

### CURRENT FRONTEND

Statuses are `submitted`, `under_review`, and `review_ready`, advanced by a browser interval after 6/20 seconds. `StatusBadge` only knows the demo status set.

### FUTURE BACKEND NEED

Expose server-owned status such as `SUBMITTED`, `ACCESS_CHECKING`, `NEEDS_ATTENTION`, `QUEUED`, `UNDER_REVIEW`, `REVIEWED_HIDDEN`, `CLOSED`, `FINALIZING`, and `RESULT_READY` once exact names are agreed. Include review-attempt number, access-check outcome, queue timestamps, and retryability.

### LEGACY MOCK BEHAVIOR TO REMOVE

Browser timers and any client ability to set review status.

## 13. Final Result

### CURRENT FRONTEND

`buildReviewResult()` deterministically creates a score/rubric/feedback object. The result route displays it as soon as the mock review is ready and opening the route marks the project completed.

### FUTURE BACKEND NEED

Persist review output, keep it hidden until weekly finalization, wait for required final reviews, publish the final result/feedback after ranking and points are calculated, and expose a stable result view by owned enrollment/version.

### LEGACY MOCK BEHAVIOR TO REMOVE

Immediate visible result, opening-a-page completion, and client-generated scores.

## 14. Leaderboard

### CURRENT FRONTEND

No leaderboard exists. Showcase uses mock editorial winners and weekly history.

### FUTURE BACKEND NEED

Provide a global cross-division weekly leaderboard ordered by `final_score DESC, final_submitted_at ASC`, with rank, participant display data, project/division, final version, and publication state.

### LEGACY MOCK BEHAVIOR TO REMOVE

Treating Showcase or `WEEK_HISTORY` as the global leaderboard.

## 15. Arena Points

### CURRENT FRONTEND

`careerPoints` starts at 320 and is incremented by `review.pointsEarned` during local completion. Profile and Career Report display the balance.

### FUTURE BACKEND NEED

Provide a server-owned account balance and immutable ledger with source event, week, rank, amount, idempotency key, timestamps, and non-expiry policy. Finalization awards #1 300, #2 200, #3 150, and #4+ 100.

### LEGACY MOCK BEHAVIOR TO REMOVE

Client point mutation and the current project-point display, including the featured `+120` result. `+120` is not a production rule.

## 16. Rewards

### CURRENT FRONTEND

A read-only public catalog exists at `GET /api/arena/rewards/catalog` (active SKUs only, seeded from the locked PRD §35 reward plus inactive website-proven proposals). No redemption, inventory locking, fulfillment, or history exists yet — those remain Phase 7. A deleted HEAD-era mock rewards file is not active.

### FUTURE BACKEND NEED

Provide point balance/history, reward catalog, limited available inventory, locked/unavailable state, redemption confirmation, redemption history, idempotency, inventory locking, and fulfillment state. Confirmed reward: 2,000 Arena Points → USD 20, limited inventory. Do not implement a fixed point/USD conversion.

### LEGACY MOCK BEHAVIOR TO REMOVE

Any UI implication that project points directly equal a cash value.

## 17. Notifications

### CURRENT FRONTEND

Only transient in-memory toasts exist.

### FUTURE BACKEND NEED

Provide durable notification records/read state and, if scoped, delivery preferences/channels for project drop, deadline reminder, submission receipt/access failure, result ready, points awarded, and reward events.

### LEGACY MOCK BEHAVIOR TO REMOVE

Treating a toast as durable delivery or event history.

## 18. Career Report

### CURRENT FRONTEND

`buildCareerReport(state)` computes averages, skills, progress, history, and next-project recommendation from local history, static skill levels, and mock jobs.

### FUTURE BACKEND NEED

Return a read model based on persisted CV analysis, valid reviewed projects, final scores, proven skills, points ledger, and recommendations. Define freshness and versioning.

### LEGACY MOCK BEHAVIOR TO REMOVE

Static progress `72`, static weak skills, seeded history, and local-only aggregation.

## 19. Jobs Bridge

### CURRENT FRONTEND

`/app/jobs` shows six mock matches, a hard-coded “24 matches” summary, and links to `https://jobs.sekolahkarir.id` in a new tab.

### FUTURE BACKEND NEED

Define the canonical jobs portal handoff, identity propagation, privacy/consent, match API or server-generated link, and error state. Reuse the Sekolah Karir identity rather than creating another account.

### LEGACY MOCK BEHAVIOR TO REMOVE

Hard-coded matches and match counts.
