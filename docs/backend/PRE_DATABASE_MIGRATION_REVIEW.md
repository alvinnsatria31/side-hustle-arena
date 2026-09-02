# Arena - Pre-Database Migration Review

## Arena Migration Chain

1. `0000_previous_thing.sql`
2. `0001_pink_khan.sql`

## Canonical Migration Chain

1. `0000_lazy_karnak.sql` through `0009_small_mongu.sql`
2. `0010_phase_3_4_proposal_drafts.sql`
3. `0011_cultured_lilandra.sql`

## Arena Auth Migration

`0001_pink_khan.sql` creates `identity.sessions` for opaque, hash-at-rest Arena sessions. It remains consistent with the current Arena Drizzle schema; Phase 2D created no Arena schema change.

## Canonical SSO Migration

`0011_cultured_lilandra.sql` now contains only the `sso_authorization_codes` and `sso_grants` tables, their foreign keys, and their indexes.

## Proposal Schema Contamination Finding

The original `0011_cultured_lilandra.sql` also recreated `proposal_draft_status` and the complete `proposal_drafts` table/index/foreign-key set.

## Root Cause

`0010_phase_3_4_proposal_drafts.sql` already contains the proposal schema and is recorded in the Drizzle journal. However, the migration metadata has snapshots through `0009` and then `0011`, with no `0010_snapshot.json`. When the Phase 2B generator compared the current schema against the last snapshot, it detected both the already-migrated proposal schema and the new SSO schema and placed both into 0011.

## Resolution

CLEAN SPLIT. Because 0011 has never been applied, its duplicate proposal statements were removed. Proposal schema remains solely in the pre-existing 0010 migration and 0011 is SSO-only. Offline generation reports no schema changes.

## Exact Migrations Safe for Development Database Application

For a fresh, disposable development database after explicit Phase 2E authorization, apply the Arena chain `0000_previous_thing.sql`, `0001_pink_khan.sql` and the Canonical chain `0000_lazy_karnak.sql` through `0011_cultured_lilandra.sql` in their recorded order.

## Migrations That Must Not Be Applied Yet

All listed Arena and Canonical migrations remain unapplied in this phase. They must not be applied to any real database until Phase 2E database bring-up is explicitly authorized.

## Migration Application Order

1. Create an isolated, disposable development database.
2. Apply the recorded Canonical chain through corrected 0011.
3. Apply the Arena chain through 0001.
4. Run the authorized DB-backed SSO integration and replay/concurrency tests.

Do not execute these steps in Phase 2D.

## Rollback / Recovery Considerations

No migration was applied here. Before first application, validate the complete chains against a disposable database. If a development application fails, discard and recreate that isolated database rather than editing an already-applied historical migration.

## Database Bring-Up Readiness

READY for an explicitly authorized isolated development-database review. Real database connection and migration application remain out of scope.
