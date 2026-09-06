# VPS And Configuration Audit - 2026-09-06

## Verified Access

- SSH succeeds through existing local alias `sekolahkarir`, user `mindtrack`, host `202.74.75.95`.
- Existing local private key authenticates; the newly supplied public key was not installed or needed. No private key was copied.
- n8n, two Hermes containers, and 9router are running. n8n reports healthy.
- Audit reads n8n SQLite using `mode=ro` and `PRAGMA query_only=ON`. No workflow activation, imports, restart, payments, notifications, or remote configuration changes were performed.

## Confirmed Integration Gaps

| Priority | Evidence | Required work |
| --- | --- | --- |
| P1 | Live `arenagrading0001` is active; Post Result points to `https://arena.sekolahkarir.id/api/webhooks/arena-eval`, but body markers still contain `submission_id` and `rubric_breakdown`, without `version_id` or `criterionId`. | Migrate input/rubric/source/lease and output contracts together; URL repoint alone is insufficient. |
| P1 | Live `arenaquestcrea01` inserts `weekly_quests` through legacy Supabase REST. | Connect validated generator output to the current Neon-backed project/week lifecycle. |
| P1 | Live `arenasunday00001` fetches submissions and marks release in legacy Supabase. | Replace release authority with current week finalization; prevent two competing release/points systems. |
| P2 | Latest matching retained execution found was Sunday release, `error`, `2026-08-30 01:00:00.093`. | Diagnose the actual failed node before reactivation/cutover. Retention limits mean this is not a complete execution history. |
| P2 | Live workflow exports differ from JSON files in `/home/mindtrack/side-hustle-arena`. | Use a fresh live snapshot for migration, not the old files. |

## Local Configuration Inventory

Presence checked without printing secret values. Presence does not prove validity or production parity.

- Present: `DATABASE_URL`, `SESSION_SECRET`, auth origins, AI endpoint/key and review/judge/generation model names.
- AI mode is `openai-compatible`; all three configured model names currently match. This is a separate blind pass, not model diversity.
- Missing locally: canonical/legacy storage credentials, `ARENA_EVAL_TOKEN`, `INTERNAL_AUTOMATION_TOKEN`, `CRON_SECRET`, admin subject/roles or separate admin token, Resend key/sender, voucher contract variables.
- `AI_VALIDATOR_MODEL` absent; current validator is deterministic server code, so this alone does not block review.
- `COOKIE_DOMAIN` absent; normal for localhost, must be checked against the production participant cookie before cutover.
- Generation enable/auto-publish flags absent. Defaults and actual scheduler coverage need verification.

## Safe Audit Tool

`scripts/vps-readonly-audit.py` inventories workflow topology, endpoint paths, contract marker presence, credential types, recent execution status, and container environment **names only**. Discord webhook path secrets are redacted. Run via SSH stdin; no remote audit file is created.

## Next Checks

- Read bridge configuration names and auth boundaries; inspect sanitized failure metadata.
- Verify actual local database schema/counts and model endpoint availability without modifying product records.
- Check production domain routing and environment availability.
- Produce exact operator inputs and a concrete migration package before modifying live workflows.

## Completed: Runtime And Data Verification

Verified on 2026-09-06 using `node scripts/audit-runtime-config.mjs`:

- Configured database is reachable in a read-only transaction. It contains 1 week (`CLOSED`), 4 projects, 6 catalog entries, 0 review jobs, 0 evidence snapshots, 0 inventory periods and 0 redemptions.
- `arena.review_artifacts` and `arena.review_scores.evidence` exist. Migration presence is verified for this connection only; production database identity is not established.
- There is no open week for a real participant cycle in this database. LIMITED rewards have no inventory periods available yet.
- AI `/models` responds HTTP 200; all configured review/judge/generation model IDs are listed. No inference request was sent, so inference permission, scoring behavior and cost remain unverified.
- `https://arena.sekolahkarir.id/` responds HTTP 307 from Vercel. `/api/arena/week/current` and `/api/arena/projects` both respond HTML HTTP 404. The new API is not available at these production paths; DNS alone is not sufficient evidence of deployment.
- Local origins are Arena `http://localhost:3001` and main site `http://localhost:3000`.
- Arena's local `SESSION_SECRET` differs from both `.env` and `.env.local` in the sibling website checkout, and from the old Arena checkout. Actual process/Vercel environment overrides were not checked. Cross-site login cannot be assumed to work from these files; choose the canonical main-site signing secret and align Arena without rotating the main site's secret.
- Main-site `.env.local` contains a Resend key; validity, sender ownership and permission to reuse that project's email configuration are not verified. Existing webhook tokens have legacy names and must not be assumed interchangeable with the new worker/eval/admin scopes.
- The actual agent process on port 8791 runs from `/home/mindtrack/hermes-multiagent`; GET `/health` returns HTTP 200. This is distinct from `/home/mindtrack/content_engine`, whose env inventory was also checked. Do not assume the content engine's model settings control the Arena agent.
- UFW is active, allows public SSH/HTTP/HTTPS and Docker bridge interfaces. A listener on `0.0.0.0:8791` is not by itself proof of public access; external reachability was not probed.

## Additional Code/Configuration Blockers

1. `vercel.json` schedules project-drop Monday 01:00 UTC (08:00 WIB). `prepareScheduledWeek()` only accepts the Sunday preview window and rejects `now >= opensAt`, which is Monday 01:00 UTC. The configured cron therefore misses generation even if flags are enabled. Generation and publication need separate scheduled phases.
2. `notify()` currently defaults to IN_APP only, and `flushPendingEmails()` only selects PENDING, not FAILED. A Resend key alone cannot finish product email delivery/retries.
3. Hermes contract documentation previously accepted free-form evidence and claimed webhook-only grading needed no AI key. Current production validation requires `[source-id] exact quote`; a routed second judge also needs its configured provider. The old guidance is superseded.

## Inputs Still Needed From Owner

| Input | Why needed | How to provide |
| --- | --- | --- |
| Canonical admin account | Grant the correct authSubject, not an arbitrary local user. | Email/username is enough; never send its password. |
| USD 20 fulfillment method and budget/stock policy | Establish payout destination requirements, inventory quantities and responsible operator. | Choose manual transfer or name the payout provider. |
| Tencent COS bucket/region and usable credentials | No local canonical or legacy storage credentials are present. | Configure secrets in local/Vercel environment or identify the existing authorized configuration location; do not paste private keys in chat. |
| Target Vercel project/environment | Current production domain does not expose the new API; deployment and production env parity remain unverified. | Identify the project or use an already-authenticated Vercel session. |

No new model key or SSH key is currently needed for this audit. Automation/eval/admin secrets can be generated during integration; their values must be coordinated between systems rather than copied from unrelated legacy tokens.

## Verification And Scope

- Remote read-only inventory and health requests succeeded; no workflow was run or changed.
- Local runtime audit completed; all DB statements ran inside a read-only transaction.
- Fresh offline tests: 7/7 audit regression/provider-evidence tests passed.
- No live AI scoring, actual payment, email send, full browser participant flow, production migration or deployment was performed in this audit.
- Earlier end-to-end implementation notes are historical checkpoints. The audit does not declare Arena production-ready.
