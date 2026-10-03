# Arena admin API — contract for the unified admin

For the team building the unified admin in `sekolah-karir-website`. Status on
3 October 2026.

This lists every Arena admin action the central panel may call, including the
ones that until now only Arena's own console (`/app/admin`) used. Every route
below already exists, is the one that console calls, and accepts the panel's
bearer. Nothing here is a second API.

"Verified" means it was called through the real route handler with the
central-admin bearer against the isolated sandbox database, by
`scripts/unified-admin-contract-integration.test.mjs`
(`npm run test:local:unified-admin`), or for read routes by
`scripts/unified-admin-live-check.mjs`. Nothing has been verified on staging or
production.

## Common rules

**Authentication.** `Authorization: Bearer <CENTRAL_ADMIN_TOKEN>`, from the
website's server only. The token carries its own scopes (`CENTRAL_ADMIN_SCOPES`).
A missing or wrong bearer, or a missing scope, answers `403`
`{"error":{"code":"FORBIDDEN",…}}`. A bearer is never combined with a cookie
session.

**Actor.** Arena records the configured `CENTRAL_ADMIN_SUBJECT` as the actor of
every write. Any `actorSubject` in a body is ignored. Per the PRD, the operator
is identified by server configuration. Arena therefore does not know which
person in the panel acted, and the panel must keep its own record of that.

**Reason.** Every write that changes money, points, access, an account or a
participant's result requires `reason` (trimmed, 1–1000 characters). It is
stored in the audit row's metadata. Exceptions are listed per route.

**Response envelope.** Success is `{"data": …}`. Errors come in two shapes:

| Shape | When | Example |
| --- | --- | --- |
| `{"error":{"code","message","details"?}}` | A domain rule refused the action. `message` is for a human, sometimes in English. Product validation errors also carry `details.field` | `409 {"error":{"code":"PRODUCT_SLUG_TAKEN","message":"Slug \"x\" sudah dipakai produk lain.","details":{"field":"slug"}}}` |
| `{"data":{"reason":"VALIDATION_ERROR"}}`, status `400` | The body or a path id failed the route's schema (missing field, bad UUID, wrong type) | |
| `{"data":{"reason":"UNKNOWN_ACTION"}}`, status `404` | The `{action}` path segment is not one the route knows | |

Status codes in use: `200`, `201` (product create), `400`, `403`, `404`, `409`
(conflicts), `500` (`INTERNAL_ERROR`, unexpected), `502`, `503`
(`FEATURE_CLOSED`, `STORAGE_NOT_CONFIGURED`).

**Audit.** Every write below appends to `audit.logs` (append-only) in the same
transaction as the change, except where noted. `GET /api/internal/admin/audit`
(scope `overview`) reads the log back.

**Idempotency.** No route takes an idempotency key. Where a repeat is safe, it
is safe by state: the second call finds the work done and changes nothing. Each
route says which.

## Already integrated in the panel

Exercised end to end, including in a browser through the website's gateway:
every read tab; product create and edit (with `expectedUpdatedAt`,
`409 PRODUCT_EDIT_CONFLICT` and `409 PRODUCT_SLUG_TAKEN`); division create; and
week create.

In the panel's allowlist but **not yet exercised** against Arena:
- weeks reschedule, generate, publish, close and finalize;
- reviews rerun and override;
- rewards fulfil and reverse;
- projects approve, veto and schedule.

Generate and rerun call a model, and finalize awards points. Run those only on
sandbox data, with the AI keys blank. See `UNIFIED-ADMIN-HANDOFF.md`.

## Actions so far only in Arena's console

### Users — suspend and restore

`POST /api/internal/admin/users/{userId}/status` · scope `users` · **verified**

```json
{ "status": "SUSPENDED", "reason": "…" }      // or "ACTIVE"
```

- `200 {"data":{"done":{"userId","status"}}}`
- `400 VALIDATION_ERROR`: bad UUID, missing reason, unknown user. An unknown
  user is `400`, not `404`.
- Audit `USER_STATUS_SET` `{previousStatus, status, reason}`.
- Repeating the same status succeeds again and writes another audit row.
- Arena refuses self-suspension only when the actor's subject equals the user's
  `authSubject`. With the panel's service subject that never matches, so **the
  panel must stop an operator from suspending their own account itself.**

### Reward catalogue and stock

`POST /api/internal/rewards/inventory` · scope `rewards` · **verified**. The
body is one of four shapes, chosen by `action`:

| `action` | Body | Rule | Audit |
| --- | --- | --- | --- |
| `catalog` | `{rewardId, isActive, reason}` | — | `REWARD_CATALOG_SET` `{previousActive, isActive, reason}` |
| `quantity` | `{periodId, quantityTotal, reason}` | `quantityTotal ≥ reserved + fulfilled` | `REWARD_INVENTORY_SET` `{previousTotal, quantityTotal, reason}` |
| `period` | `{rewardId, periodStart, periodEnd, quantityTotal, reason}` (ISO datetimes) | reward is `LIMITED`, end after start, no overlap with that reward's periods | `REWARD_INVENTORY_CREATED` |
| `delivery` | `{rewardId, deliveryUrl, reason}` (`deliveryUrl` https or `null`) | reward is `DIGITAL` | `REWARD_DELIVERY_URL_SET` `{previousDeliveryUrl, deliveryUrl, reason}` |

- `200 {"data":{"done":{"id"}}}`; a rule violation is `400 VALIDATION_ERROR`
  with a message.
- `GET /api/internal/rewards/inventory?q&limit&offset` returns
  `{rewards:[full catalogue rows incl. isActive, deliveryUrl, inventoryMode, rewardType], periods:[{id, rewardId, periodStart, periodEnd, quantityTotal, quantityReserved, quantityFulfilled}]}`,
  periods limited to the rewards on the page.
- The four actions are absolute sets, so a repeat changes nothing except
  `period`, which a repeat refuses as an overlap.

### Reward claims — voucher push and void retry

`POST /api/internal/rewards/{redemptionId}/{push-voucher|retry-void}` ·
scope `rewards` · **not exercised** (calls the main site's voucher API).

- `push-voucher` (no body) pushes a voucher code to the main site and marks the
  claim fulfilled on success.
  - Responses: `{status: "DELIVERED" | "MANUAL_REQUIRED" | "IN_PROGRESS" | "ALREADY_SETTLED" | "REVOKED" | "NOT_VOUCHER", code?, reason?}`
    in `data.done`.
  - A lease makes concurrent pushes safe: the second one returns `IN_PROGRESS`.
- `retry-void` (no body) re-voids a code on the main site for a reversed voucher
  claim with an open reconciliation. Returns `{code, voided, error}`.
- Both are external side effects. Keep them out of the panel until the owner
  approves voucher operations from it; the legacy `rewards` section stays
  until then.

### Orders — fulfil, cancel, points refund

`POST /api/internal/store/orders/{orderId}/{fulfill|cancel|refund}` · scope
`store` · body `{reason}` · **verified**

The list rows (`GET /api/internal/store/orders`) carry `status`
(`PENDING|PAID|FULFILLED|FAILED|EXPIRED|REFUNDED`) and `paymentMethod`
(`IDR|POINTS`), which is all the panel needs to decide which buttons to show.

| Action | Allowed when | Effect | Repeat | Response |
| --- | --- | --- | --- | --- |
| `fulfill` | `PENDING` or `PAID` | Marks the order paid and fulfilled and grants the entitlement. The reason is stored as `providerStatus = "manual:<reason>"`. Audit `STORE_ORDER_FULFILLED`. Enqueues an in-app notification | `FULFILLED` again → `fulfilled:false`, nothing written | `{done:{fulfilled, order}}` |
| `cancel` | `PENDING` | Sets `FAILED` with the reason. Audit `STORE_ORDER_FAILED` | `{closed:false}`, nothing written | `{closed}` |
| `refund` | `paymentMethod = POINTS` **and** `status = FULFILLED` | Returns the points (ledger key `store-order:<id>:refund`), revokes the entitlement, sets `REFUNDED`. Audit `STORE_ORDER_REFUNDED` | `REFUNDED` again → `200`, nothing written | `{refunded:true}` |

- Any other state is `400 VALIDATION_ERROR` with an Indonesian message.
- **Rupiah is never refunded here.** An IDR refund is always refused with
  "Pesanan Rupiah direfund lewat dashboard Midtrans". No route moves money.
- `fulfill` on an IDR order calls nothing at Midtrans. It is the escape hatch
  for a payment that settled at Midtrans whose notification never arrived, and
  it declares money received. The operator must confirm it in Midtrans first.
  Whether the panel offers it is a product decision for the owner.

### Product file upload

`POST /api/internal/store/upload-url` · scope `store` · body
`{"mimeType":"application/pdf"}` · **verified**

1. `200 {"data":{"upload":{"uploadUrl","storageKey"}}}`. Arena mints the key;
   the caller never chooses it.
2. `PUT` the bytes to `uploadUrl` with the same `Content-Type`, within **600
   seconds**.
3. Save the product with `deliveryKind:"FILE"`, `deliveryObjectKey: storageKey`
   and `deliveryFilename`. Arena checks that the object exists. If it does not:
   `400 VALIDATION_ERROR` with `details.field = "deliveryObjectKey"`.

Not audited until step 3, whose product write is audited.

**Blocker before the panel can use this from a browser.** The bucket's CORS
rule allows only Arena's own origins, so a `PUT` from
`https://www.sekolahkarir.id` is blocked. Two options:

- The owner adds the website's origin to the bucket CORS rule. This is a
  production storage change and needs the owner's approval.
- The website server relays the bytes. This is limited by the website host's
  request-size cap.

Until one is chosen, the legacy `store` section stays.

### Emergency switches (flags)

`POST /api/internal/admin/flags` · scope `rewards` for `rewards-redemption`,
`projects` for the others · **verified**

```json
{ "key": "arena-publish", "closed": true, "message": "Teks untuk peserta", "reason": "…" }
```

- Keys: `arena-enrollment`, `arena-submissions`, `arena-publish`,
  `rewards-redemption`.
- `message` (≤500, nullable) is what participants see. `reason` (1–1000) is
  **new**: optional so the legacy console keeps working, but the panel should
  always send it.
- `200 {"data":{"done":{"key","closed"}}}`; an unknown key is `400`.
- Audit `FEATURE_FLAG_SET` `{closed, previousClosed, message, reason}`.
- Absolute set; a repeat changes nothing.
- Current state: `GET /api/internal/admin/overview` →
  `data.overview.flags = [{key, label, blurb, state:{closed, message}}]`. A
  missing row reads as open. There is no `updatedAt`; use the audit log.

### Enrolment void (fraud / plagiarism)

`POST /api/internal/enrollments/{enrollmentId}/void` · scope `reviews` · body
`{reason}` · **verified**

- `200 {"data":{"done":{"enrollmentId","pointsRevoked"}}}`.
- Marks the enrolment and its submission `VOIDED`, removes the ranking and the
  skill evidence, and takes back awarded points once (ledger key
  `void:<enrollmentId>`, balance floored at 0).
- A repeat succeeds with `pointsRevoked: 0` and writes another audit row.
- Audit `FRAUD_VOID` `{reason, pointsRevoked, weekFinalized}`.
- Not reversible from any route. The enrolment id comes from the reviews list
  (`enrollmentId`).

### Rubric authoring

`PATCH /api/internal/admin/divisions` · scope `projects` · **verified**

```json
{ "divisionId": "…", "baseRubric": [ { "name": "Analisis", "weight": 60, "maxScore": 100 } ] }
```

- 1–20 criteria, unique names (case-insensitive), weight and maxScore each
  between 0 (exclusive) and 100. May be combined with `name`, `description`,
  `isActive` and `sortOrder` in the same PATCH, or sent on create (`POST`).
- **Freezes once and can never be replaced.** A second rubric is `400` "already
  frozen". The panel needs a strong confirmation step.
- Audit `generation.rubric-frozen` `{rubric}` plus `DIVISION_UPDATED`.
- No `reason` field.
- `GET /api/internal/admin/divisions` returns `hasBaseRubric` and `baseRubric`
  per division.

### Projects — detail, edit, attribute, schedule, approve/veto/regenerate, cover

`GET /api/internal/admin/projects/{id}` · scope `projects` → `{project, week,
division, package, validatedAt, validationSource, rubricCriterionIds,
skillOptions}`.

`package` is the stored generator JSON: nested, and not a UI contract. Render
it defensively.

`POST /api/internal/admin/projects/{id}/{action}` · scope `projects`:

| Action | Body | Effect | Verified |
| --- | --- | --- | --- |
| `approve` / `veto` | `{reason}` | approve → `SCHEDULED/APPROVED`; veto → `REJECTED/REJECTED` | in the panel's allowlist; not exercised here |
| `regenerate` | `{reason}` | Sets `REJECTED` / `REGENERATE_REQUESTED` only; **the next generation run** produces a replacement, which calls a model | yes (flag only) |
| `edit` | `{reason, package}` | Revalidates the whole package and resets preview to `PENDING`. Afterwards it refreshes the AI cover if a cover provider is configured | no (needs a full valid package; covered by the generation suites) |
| `attribute` | `{reason, attributions:[{criterionId, skillId|null}]}` | Rubric criterion → skill, until the week is finalized | no |
| `schedule` | `{reason, scheduledPublishAt|null}` | Sets the publish time | in the panel's allowlist; not exercised here |
| `cover` | `{reason, force?}` | Generates the card image with an **image model**. Without a provider it answers `{skipped:"cover provider not configured"}` | yes (skip path only) |

- Published or archived projects, or a week past its deadline, answer
  `409 WEEK_NOT_READY`.
- Each action writes an audit row with the reason.
- `regenerate`, `edit` (cover refresh) and `cover` can lead to AI calls; keep
  them out of the panel unless the owner allows AI-triggering actions there.

### Email outbox

`GET /api/internal/admin/email-outbox?bucket&limit&offset` and
`POST /api/internal/admin/email-outbox/{requeue|cancel}` · scope
**`notifications`** (not in the panel's scope list today) · **verified**

- Buckets: `due`, `backingOff`, `inFlight`, `held`, `skipped`, `sent`.
- `GET` returns `{summary, rows}`.
- Body `{deliveryId, reason}`. `cancel` sets `SKIPPED/ADMIN_CANCELLED`.
  `requeue` sets `PENDING` with retry counters reset; **the email worker will
  then really send it**.
- A delivered email cannot be requeued or cancelled (`400`). A row whose worker
  lease is live is refused (`400`).
- Audit `EMAIL_DELIVERY_REQUEUED` / `EMAIL_DELIVERY_CANCELLED` with the reason.
- To use it: add `notifications` to `CENTRAL_ADMIN_SCOPES`. That is an owner
  decision, because `requeue` sends real mail.

### Scheduled jobs and off-schedule launch

- `GET /api/internal/admin/jobs` (scope `overview`) returns
  `{jobs, readiness, runs}`: the catalogue, configuration readiness and the
  last 20 runs.
- `POST /api/internal/admin/jobs` with `{job}` runs one job now. The scope
  depends on the job: `project-generate`/`project-drop` → `projects`,
  `reviews-run` → `reviews`, `week-close`/`week-finalize` → `weeks`,
  `week-notifications`/`email-flush` → `notifications`, `session-cleanup` →
  `users`, `storage-cleanup` → `storage`, `jobs-sync` → `careers`,
  `store-expiry` → `store`.
- `POST /api/internal/admin/launch` (scope `projects`) runs generation, and
  optionally publication, for a week. It **calls a model**.
- Not exercised. These start automation (AI review, generation, email sending),
  so they need the owner's decision before any panel button.

### Careers, career report, CV scanner — outside this scope

Routes exist: `GET/POST /api/internal/admin/job-sources` (scope `careers`),
`GET /api/internal/admin/career-report[/{userId}]` (scope `users`). The CV
scanner has no admin route.

Per this repository's `AGENTS.md`, the Jobs portal, Career Report and CV
Scanner are not modified without the owner's explicit approval. They were not
changed or exercised here, and these sections stay on the legacy console.

## What the panel needs before each legacy section can retire

A section leaves `ARENA_LEGACY_ADMIN_KEEP` only after the panel has every
action below **and** it has been run against Arena (sandbox first).

| Section | Needs in the panel | Arena side |
| --- | --- | --- |
| `users` | Suspend / restore (with a self-guard) | Ready |
| `flags` | Switch view + toggle with reason | Ready (reason added) |
| `divisions` | Rubric authoring with an irreversible-action confirm | Ready |
| `reviews` | Enrolment void | Ready; needs a website allowlist entry for `enrollments/{id}/void` |
| `rewards` | Stock / catalogue / delivery link; voucher push and void retry | Stock ready. Voucher: owner decision (external API) |
| `store` | Order fulfil / cancel / points refund; file upload | Orders ready. Upload: bucket CORS decision |
| `projects` | Detail, edit, attribute; regenerate and cover | Ready. Regenerate/cover/edit: owner decision (AI) |
| `email`, `jobs`, `workflows` | Outbox, job runs, launch | Ready; owner decision (sends mail, starts automation, AI) |
| `careers`, `career-report`, `cv-scanner` | — | Out of scope without the owner's approval |
