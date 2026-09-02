# Development Database Setup

## Scope

This runbook is for the isolated Phase 2E environment only. It does not authorize production database access, deployment, or migration execution against an unclassified target.

## Arena development database

Arena uses a development-only `DATABASE_URL` in ignored `.env.local`. Before migrations run, `npm run db:migrate` requires `APP_ENV=development` or `APP_ENV=test`, requires a PostgreSQL URL, and loads local environment configuration without printing credentials.

Run from the Arena repository:

```powershell
npm run db:generate
npm run db:migrate
npm run db:check
```

`db:migrate` applies the reviewed Arena Drizzle migration to the configured local development target. It must never be used with a production URL.

## Canonical local database

The Canonical workspace uses its existing Docker PostgreSQL development fallback. Start only the database service from `D:\Sekolah Karir Workspace`:

```powershell
docker compose up -d postgres
npm run db:generate
npm run db:migrate
```

The service is local Docker PostgreSQL on port `5433`; Canonical's migration runner reports its local fallback when `DATABASE_URL` is absent. No production connection is needed.

## Local SSO configuration

Ignored local environment files configure only these localhost origins:

- Canonical: `http://localhost:3000`
- Arena: `http://localhost:3001`
- Canonical callback allowlist: `http://localhost:3001/auth/callback`

The Arena client secret remains server-only and is generated/configured locally. Do not copy it into client code, `NEXT_PUBLIC_*` values, logs, URLs, or committed files.

Start the local applications in separate terminals:

```powershell
# D:\Sekolah Karir Workspace
npm run dev -- -p 3000

# D:\Side Hustle Arena
npm run dev -- -p 3001
```

## Verification commands

Run from `D:\Side Hustle Arena` after both local applications and databases are ready:

```powershell
node --test scripts/db-migrate.test.mjs
npm run test:db:local
npm run test:sso:local
$env:RUN_CANONICAL_OUTAGE_TEST = '1'
node --test --test-name-pattern='Canonical outage fails closed' scripts/db-sso-integration.test.mjs
Remove-Item Env:RUN_CANONICAL_OUTAGE_TEST
```

The outage check deliberately stops and restarts only the verified Canonical localhost development-server process tree. It never targets production.

## Retention boundary

Arena session and Canonical authorization-code/grant cleanup helpers exist as explicit maintenance operations. They are not invoked by authentication requests and no production scheduler was created in Phase 2E.

## Safety checklist

- Keep `.env.local` ignored and never print values.
- Confirm the target is development/test before running migrations.
- Do not run `drizzle push`.
- Do not run production migration, deployment, or remote-push commands.
