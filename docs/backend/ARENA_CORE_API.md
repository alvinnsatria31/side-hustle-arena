# Arena Core API

Phase 3 adds a server-authoritative API for the current Arena week, visible projects, one project selection per user/week, and private workspace progress. It does not add submissions, files, review, leaderboards, rewards, or administration.

| Endpoint | Authentication | Result |
| --- | --- | --- |
| `GET /api/arena/week/current` | Public | Resolved persisted week with `selection.canSelect`. |
| `GET /api/arena/divisions` | Public | Active divisions only. |
| `GET /api/arena/projects?division=<slug>` | Public | Published projects in the resolved current week and active divisions only. |
| `GET /api/arena/projects/[slug]` | Public | Visible project with skills, rubric, and requirements. |
| `POST /api/arena/enrollments` | Arena session + same-origin | Creates a selection, or returns the caller's existing same-project selection. |
| `GET /api/arena/enrollments/current` | Arena session | Caller enrollment in the resolved current week, or `null`. |
| `GET /api/arena/enrollments/[id]` | Arena session | Caller enrollment only. |
| `GET/PATCH /api/arena/enrollments/[id]/workspace` | Arena session; PATCH same-origin | Caller workspace read/lazy upsert. |

All endpoints are dynamic and send `Cache-Control: no-store`. Mutation handlers require the Arena local session, derive the user from it, and reject client-supplied `userId` or `weekId`. JSON bodies and route/filter values are strictly validated with Zod.

`POST /api/arena/enrollments` accepts exactly `{ "projectId": "<uuid>" }`. A new selection returns `201`; a same-project retry returns `200`; a different project in the same week returns `409 ALREADY_ENROLLED_THIS_WEEK`. The database unique constraint remains the final concurrency guard.

Workspace PATCH accepts bounded `currentStep`, `planText`, `tools`, `taskBreakdown`, `notes`, and `reviewChecklist` fields. The workspace is created lazily and updates are blocked at the persisted deadline.

Current-week reads never mutate lifecycle status. They choose the most recently opened eligible `OPEN` week, then the earliest future `SCHEDULED`/`PREVIEW` week, then the most recently ended `CLOSED`/`FINALIZING`/`FINALIZED` week. Selection/workspace writes require persisted `OPEN`, an arrived open time, and server time strictly before `submissionDeadlineAt`; the exact deadline is locked.

`npm run db:seed:arena` is development-only. It upserts one `DEV-ARENA-CORE-CURRENT` week using Asia/Jakarta Monday/Friday timestamps, three active divisions, three published projects, and one draft. Reruns refresh only deterministic `dev-arena-core-*` records and metadata without touching unrelated Arena data.
