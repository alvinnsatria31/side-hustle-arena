# Arena Operational Completion Design

**Date:** 2026-09-11

**Goal:** Complete seven operational gaps across Arena publication, active-week selection, AI grading context, immutable link evidence, voucher reconciliation, WhatsApp support, and live setup documentation without regressing existing participant or admin flows.

## Scope

This design covers only the seven requested tasks:

1. Require resources on newly published projects and preserve the already populated resources on `ARENA-KICKOFF-WEEK-1`.
2. Archive `GEN-TEST-2026-W37`, make `ARENA-KICKOFF-WEEK-1` the only live OPEN week, and make the resolver prefer official kickoff weeks over test weeks when bad overlapping data exists.
3. Send the full grading context to the in-process AI reviewer and judge.
4. Reject link submissions that cannot be frozen at submission time, and prevent later live-link reads from becoming grading evidence.
5. Allow an admin to retry a failed voucher void from the Rewards console.
6. Add a global WhatsApp support button and visible CS contact copy.
7. Document live voucher configuration and initial Jobs source registration.

The work does not alter CV Scanner, Career Report, unrelated product automations, or external WhatsApp services. Jobs changes are documentation and setup instructions only; no invented provider will be registered in production.

## Design decisions

### Project resource publication gate

Every newly published project must contain at least one validated HTTPS resource. The application will not try to infer whether prose “promises data”; semantic detection would be brittle and could silently publish unusable briefs. A resource may be a dataset, template, reference, or supporting brief, so the rule also works for Design and Product projects.

The guard belongs in the shared publication validation path used by manual and scheduled publishing. Generation may still produce a package without resources temporarily for curation, but publication must hold that project with a clear reason. Participant project detail and workspace already consume stored resources; their rendering remains the delivery path.

The existing `GEN-TEST-2026-W37` retention project will not receive a dataset because the whole week is test data and will be archived. The official kickoff week already contains its intended resources and must remain unchanged except for becoming the sole active week.

### Active-week policy and live transition

The resolver will apply this ordering when more than one OPEN week exists:

1. Official `ARENA-KICKOFF` weeks, newest first.
2. Other non-test OPEN weeks, newest first.
3. `GEN-TEST` and `E2E` weeks, newest first.

This is a defensive read rule, not a substitute for clean data. The live operation will archive `GEN-TEST-2026-W37` through the Arena lifecycle/admin service where possible so the change is audited. Before mutation, the exact week statuses will be read. After mutation, the database and `/api/arena/week/current` must show `ARENA-KICKOFF-WEEK-1` as the only OPEN/current week. The archive operation is reversible through a deliberate lifecycle change, but this implementation will not reopen it automatically.

### AI grading payload

`ApiReviewProvider.review` will send the complete `BlindReviewerInput` fields needed to judge the submission:

- project title and division;
- project brief containing case background, mission, and objective;
- rubric;
- participant explanation;
- extracted immutable sources;
- evidence limits.

The system prompt will tell the model to evaluate within the project brief, treat the participant explanation as an untrusted claim that needs evidence, and respect evidence limits when assigning scores and confidence. Notes and raw attempt history remain excluded unless already required by the established blind-review contract.

The n8n grader and in-process reviewer/judge must receive equivalent grading context even if their prompt formatting differs.

### Immutable LINK submission

A LINK submission is accepted only when each link can be fetched, safely validated, extracted, and stored as a snapshot representing the content seen during submission.

The flow will be:

1. Read and validate the current draft and requirement bounds.
2. Fetch and extract every link outside the database transaction so network requests do not hold row locks.
3. Start the submission transaction, lock the submission/enrollment state, and re-check the exact link set and mutable week state.
4. Create the submission version and snapshot rows atomically from the captured data.
5. Consume the review attempt and enqueue grading only after all snapshots are available.

If a link cannot be frozen, the request fails before an attempt is consumed with this user-facing message:

> Tautan tidak dapat diakses atau gagal dibaca oleh sistem. Pastikan tautan disetel publik (Anyone with the link can view) atau unggah berkas dalam format PDF.

The review claim path must refuse a LINK source without a submission-time snapshot. It must never fetch a live link later as a fallback. File snapshot behavior remains unchanged.

If the link set changes between capture and the transactional re-check, the submission is rejected as stale rather than silently grading mismatched content.

### Voucher void reconciliation

A new `retry-void` action will call a focused service operation that retries `revokeRewardCode` for an `ADMIN_REVERSED` voucher redemption with unresolved reconciliation evidence.

The operation will:

- lock or validate the redemption and voucher type;
- require the latest reconciliation state to be unresolved;
- call the external void endpoint with the same deterministic voucher code;
- write `REWARD_VOUCHER_VOIDED` on success;
- write/update `REWARD_VOUCHER_RECONCILIATION_REQUIRED` on failure;
- return a clear status to the admin UI.

The Rewards page shows **Coba Batalkan Ulang Kode** only when the redemption is `ADMIN_REVERSED` and the latest revocation record is unresolved. Repeated success is idempotent and does not change points or inventory.

### WhatsApp support entry point

`FloatingWhatsApp` will be a small global component rendered by `src/app/layout.tsx`. It uses an inline WhatsApp SVG, avoiding another package. The anchor opens the exact requested `wa.me` URL in a new tab with `rel="noopener noreferrer"`, has an accessible name, uses `#25D366`, and shows the requested tooltip on pointer hover and keyboard focus.

The component uses fixed positioning near the lower-right corner and accounts for mobile safe-area insets so it does not sit under browser controls. Motion is a CSS hover/focus transition and respects reduced-motion styling already used by the application.

The footer and participant dashboard display:

> Jika mengalami kendala, hubungi WhatsApp CS: +62 851-1730-4579

The number is a link to the same support conversation.

### Live setup documentation

The repository will provide a production environment example containing:

```dotenv
MAIN_SITE_ORIGIN=https://sekolahkarir.id
MAIN_SITE_VOUCHER_TOKEN=<token_rahasia_voucher>
```

`docs/backend/LIVE_SETUP_GUIDE.md` will explain:

- how to set both values on `sk-vps` without committing a real token;
- how to restart only the Arena container and verify configuration presence;
- how to register a Jobs source through `/app/admin/jobs`;
- an equivalent parameterized SQL seed example for `arena.job_sources`;
- required HTTPS feed URL, adapter/config mapping, credential environment-variable name, disabled-first rollout, manual sync, and participant verification.

The implementation will not fabricate a feed URL, schema mapping, API token, or production job-source row. Those values require an actual provider contract.

## Error handling

- Publication reports the exact project held because no resource exists.
- Overlapping OPEN weeks remain visible to operators; resolver priority protects participants while data is repaired.
- AI payload validation continues through existing schemas.
- Link failures use the requested participant-friendly message while server logs retain the technical reason.
- Voucher retry distinguishes successful void, retryable failure, invalid redemption, and already reconciled state.
- WhatsApp remains a normal external link and requires no client state or API.

## Testing strategy

Each behavior change follows red-green-refactor:

- publication rejects an otherwise valid resource-less project and accepts one resource;
- week resolver prioritizes official kickoff over newer test weeks;
- AI transport contains brief, explanation, sources, and evidence limits;
- link freeze failure rejects submission without creating a version, consuming an attempt, or enqueueing a job;
- review source preparation refuses a missing LINK snapshot;
- voucher retry-void succeeds, fails visibly, and is idempotent;
- WhatsApp component exposes the exact accessible label, URL, safe target/rel, tooltip, and global mount;
- documentation/config contract tests assert required example keys and Jobs setup instructions.

Final verification consists of targeted tests, `npm run test:offline`, `npm run typecheck`, and `npm run build`. The live week mutation runs only after the implementation checks pass, followed by read-only database verification and GET verification of `/api/arena/week/current`.

## Deployment and operational boundaries

No real voucher token will be generated or guessed. Voucher configuration remains incomplete until the owner supplies the main-site token and the main-site POST/DELETE contract is confirmed.

No Jobs provider will be invented. The dashboard and documentation make onboarding end-to-end once a real provider URL, mapping, and credential are available.

Only Side Hustle Arena services and data are in scope. No CV Scanner, Jobs-provider external account, Career Report, WhatsApp CS/Volunteer automation, or unrelated container will be changed.
