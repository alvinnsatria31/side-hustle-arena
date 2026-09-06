# Local fixture sandbox

From the repository root, with Node 24+, installed dependencies and Docker Desktop running Linux containers:

```sh
npm ci
node scripts/local-dev.mjs
```

Open **http://localhost:3001/dev**. Choose the fixture participant or fixture admin; the server sets a two-hour HttpOnly, SameSite=Strict cookie. No secret or cookie copy/paste is needed. These are visibly named `LOCAL FIXTURE participant` and `LOCAL FIXTURE admin`, with reserved `.invalid` email addresses. They use the existing participant verification/provisioning and admin subject allowlist.

The launcher creates an ignored `.env.arena-local` with random database/storage passwords and a random session signing secret. It preserves every existing `.env` file and blanks their keys in the child process before applying isolated local settings. Do not reuse the generated file for deployment. Local database and storage are persistent Docker volumes; the application listens only on `127.0.0.1:3001`.

The first run uses pinned PostgreSQL 16 and MinIO images (pulling them if absent), creates a private fixture bucket, runs existing Drizzle migrations, and runs existing Arena/reward seed scripts. Subsequent runs reuse local data and idempotent seeds. No live cloud database is accessed. A loopback PostgreSQL database named **arena_local** is mandatory; this launcher intentionally does not accept an arbitrary pre-existing cloud database.

| Service | Local endpoint |
| --- | --- |
| Application and fixture login | http://localhost:3001/dev |
| PostgreSQL | 127.0.0.1:55432, database `arena_local` |
| Private S3-compatible API | http://127.0.0.1:59000 |
| MinIO console | http://127.0.0.1:59001 |

The MinIO console credentials are stored only in `.env.arena-local`; normal application upload flows do not require opening that console. The bucket has no anonymous access policy. Browser upload CORS is restricted to `http://localhost:3001`.

## Exercise the flow

1. Enter as fixture participant, select an avatar, open Arena, choose a seeded project and enroll.
2. Save a deliverable link/file and request an AI review. Seeded projects use their existing requirement types; the existing weekly seed follows the Jakarta submission window and closes after Friday.
3. Return to `/dev` and click **Process one local stub review**. This runs the existing `stub-dev-v1` deterministic worker against one queued job. Return to the submission to inspect its result.
4. Switch to fixture admin from `/dev` to inspect projects, weeks, review jobs, redemptions and notifications through the normal admin console.

## Deliberate external-service fallbacks

- **Authentication:** fixed local fixture identities signed by the generated local secret. Real participant login still belongs to the main website; its shared signing secret is required for deployment.
- **Database and files:** real local PostgreSQL and private MinIO, using the normal backend and S3 APIs. Production uses its separately configured database and private object store.
- **AI:** explicitly labeled `stub-dev-v1`, useful for exercising workflow only. It does not assess deliverable quality. Configure the real provider/models separately for deployment.
- **CV Scanner:** disabled in the sandbox because its actual analysis requires the real provider. No fabricated career analysis is displayed.
- **Email, external workers, voucher pushes and payouts:** no external credentials are inherited; no real delivery or money movement occurs. Notification rows and local reward state may still be exercised.
- **Reward economy:** existing catalog seed rules are retained, including inactive SKUs awaiting owner decisions. No fake payout success, free balance, or altered prices are injected.

The fixture page/actions return 404 unless `ARENA_LOCAL_SANDBOX=1`, `APP_ENV` and `NODE_ENV` are development/test, a generated-length signing secret is present, and both request and configured database are strictly loopback. Production and Vercel are denied. POST also requires the exact local Origin; proxy chains and remote forwarding addresses are denied. No caller-selected identity can be minted.

## Commands

```sh
# Initialize services/schema/seeds without starting Next
node scripts/local-dev.mjs --setup-only

# Stop local containers, retaining their volumes/data
node scripts/local-dev.mjs --stop

# Offline security and emulator addressing checks
node --import ./scripts/node-test-hooks.mjs --test scripts/local-security.test.mjs scripts/local-storage.test.mjs
```

Ctrl+C stops the application; stop containers separately with `--stop`. Ports 3001, 55432, 59000 and 59001 must be free. If the bootstrap fails, start Docker Desktop, check those ports, and retry. Do not remove `.env.arena-local` while keeping existing Docker volumes: those volumes retain the passwords used when first created.
