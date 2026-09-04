# Arena Submission API

Phase 4 adds authenticated, no-store server routes for an enrolled user's own submission. The approved frontend remains unchanged; these endpoints are not wired into it yet.

## Routes

- `GET` / `PATCH` `/api/arena/enrollments/:id/submission` — read or update bounded explanation/notes draft fields.
- `POST` `/api/arena/enrollments/:id/submission/links` — add an HTTPS, credential-free link for a configured `LINK` requirement.
- `POST` `/api/arena/enrollments/:id/submission/uploads/presign` — issue a short-lived direct-upload URL for a configured `FILE` requirement. The request never accepts an object key.
- `POST` `/api/arena/enrollments/:id/submission/uploads/:intentId/finalize` — validate the uploaded object's actual storage metadata, consume its upload intent, and add the draft item.
- `POST` `/api/arena/enrollments/:id/submission/submit` — validate requirements, create an immutable version snapshot, check technical access, and allocate a review attempt only for an accessible version.
- `GET` / `DELETE` `/api/arena/submission-items/:id?enrollmentId=:id` — issue a short-lived private download URL or remove an owned draft item. Deletion never removes an object still referenced by an immutable version.

All mutations require the existing local Arena session and exact allowed Origin. Route parameters and query values are selectors only; user identity always comes from the server session.

## Submission rules

- Draft writes, links, presign, finalize, deletion, and submission reject at `now >= submission_deadline_at`.
- Each project requirement is data-driven (`required`, minimum/maximum items, allowed MIME types, allowed link types, instructions). No deployment is required to adjust a persisted requirement.
- The service caps a submission at five files and five links, with a 20 MiB per-file limit and the configured MIME allowlist.
- Upload intent records bind the current user, enrollment, submission, requirement, random development-scoped key, expected MIME/size, and a ten-minute expiry. They are single-use.
- Snapshots copy draft fields/items into `submission_versions` and `submission_version_items`; edits affect only the draft afterwards.
- If link/file technical access fails, a version is recorded `FAILED` with no review attempt. Accessible versions allocate `review_attempt_number` atomically against the week rule, with database uniqueness as a second concurrency guard.

## Private object storage boundary (locked: Vercel + Tencent COS + Neon)

Deploy target is Vercel (serverless, no local disk). File bytes live in
Tencent Cloud COS (S3-compatible API, private bucket); all text, names,
metadata, and state live in Neon PostgreSQL via Drizzle.

Storage credentials are server-only environment variables: `STORAGE_BUCKET`,
`STORAGE_REGION` (e.g. `ap-jakarta`), `STORAGE_ACCESS_KEY_ID` (Tencent
SecretId), `STORAGE_SECRET_ACCESS_KEY` (Tencent SecretKey), and
`STORAGE_ENDPOINT` (e.g. `https://<bucket>-<appid>.cos.ap-jakarta.myqcloud.com`).
`R2_*` names remain as a transitional local fallback only. Object keys are
environment-scoped (`arena/<development|production>/<uuid>`, derived from
`APP_ENV`), random, and never derived from original filenames. The bucket must
remain private: browser operations use short-lived presigned PUT/GET URLs
(10 minutes), and no permanent public object URL is stored or emitted by the API.

Live Tencent COS direct-upload/finalize/download/delete integration requires
approved COS credentials (SecretId/SecretKey + bucket in ap-jakarta with
restricted CORS to the Vercel domain). Production is untouched until the
storage/security review passes.

## Link access checks

Link checks allow HTTPS only and reject URL credentials. Every request hop resolves DNS first, rejects private/reserved targets, pins a validated address for the connection, uses a short timeout, forwards no browser credentials/cookies, and validates each redirect target again. An inaccessible or unsafe link produces a failed version without consuming review quota.
