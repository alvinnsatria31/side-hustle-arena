# Phase 2E DB-Backed SSO Integration Report

## Environment classification

- Arena target: user-provided isolated Neon development database, checked as `APP_ENV=development` before migration.
- Canonical target: existing local Docker PostgreSQL development service (`skw-postgres`).
- Production database access: NO.
- Production migration: NO.
- Deployment and remote push: NO.

## Migration evidence

- Arena `npm run db:generate`: no schema drift.
- Arena `npm run db:migrate`: completed, then rerun successfully without duplicate-object errors.
- Arena live schema check: all expected schemas/tables present; migration history recorded.
- Canonical `npm run db:generate`: no schema drift.
- Canonical `npm run db:migrate`: completed against the local Docker fallback, then rerun successfully.
- Canonical live schema check: expected SSO tables, columns, and migration history present.

## Runtime SSO evidence

The localhost integration suite uses a disposable active Canonical fixture and confirms:

- canonical credential login and host-only canonical session issuance;
- Arena authorization-code callback and server-side exchange;
- S256 PKCE, exact redirect URI matching, hash-at-rest authorization code storage, expiry, replay rejection, and one-success concurrent consumption;
- JIT identity provisioning uniquely by canonical subject;
- opaque Arena session issuance with only its SHA-256 hash stored in Arena;
- Arena session expiry no later than canonical grant expiry;
- `/app` server protection;
- Arena logout revocation of both local session and canonical grant;
- Canonical logout propagation and due revalidation rejection;
- missing/wrong state rejection;
- external, protocol-relative, backslash, encoded, JavaScript, and data return-path rejection;
- inactive Canonical identities and suspended Arena identities rejected;
- incorrect introspection client authentication rejected;
- Canonical unavailability during due revalidation fails closed and revokes the Arena local session.

## Database-enforced constraints

`scripts/db-live-constraints.test.mjs` uses a transaction that is rolled back after verifying live unique constraints for identity mapping, enrollment, submission, submission version, review job, review, review score, rankings, point ledger, redemption, and automation idempotency. It also verifies core deadline, count, score, ranking, and redemption checks reject invalid writes.

## Retention status

Cleanup eligibility/helpers remain explicit maintenance operations. No request-path cleanup or scheduler was introduced. Scheduled retention remains a deferred production requirement.

## Limits

This is database-backed localhost/development evidence only. It is not a production or staging end-to-end claim.
