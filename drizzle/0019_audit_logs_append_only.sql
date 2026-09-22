-- Append-only enforcement for "audit"."logs".
--
-- The application layer (src/server/reviews/audit.ts) only ever INSERTs, but
-- nothing at the database level stopped an UPDATE or DELETE from rewriting
-- history. This migration closes that gap with two layers:
--
--   1. BEFORE UPDATE OR DELETE trigger (primary, role-independent). Fires for
--      every role including the table owner and superusers, so it holds no
--      matter which role the migrator or the app connects as. Both the app
--      (DATABASE_URL) and the migrator (LOCAL_DATABASE_URL) authenticate as
--      the `arena` role (see deploy/sk-vps/docker-compose.arena.yml and
--      deploy/sk-vps/arena.env.sample), which OWNS this table — and a table
--      owner keeps implicit rights that REVOKE cannot remove. The trigger is
--      therefore the real enforcement; REVOKE below is best-effort depth.
--   2. REVOKE UPDATE, DELETE (best effort). Attempted inside a guarded DO
--      block so the migration still applies when run as the owner itself
--      (REVOKE from the owner is a no-op) or on a database where the role
--      name differs (raises NOTICE instead of failing).
--
-- Idempotent: function is CREATE OR REPLACE, trigger is dropped first with
-- IF EXISTS, REVOKE cannot fail the migration.
--
-- Maintenance escape hatch: TRUNCATE is intentionally NOT blocked here (row
-- triggers do not fire on TRUNCATE; blocking it needs a separate REVOKE that
-- is likewise a no-op against the owner). Any future retention work must run
-- as a superuser/owner and DROP TRIGGER "logs_no_update_delete" explicitly,
-- which keeps bulk history rewrites a deliberate, auditable operation.
CREATE OR REPLACE FUNCTION "audit"."prevent_logs_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit.logs is append-only: % not allowed', TG_OP;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "logs_no_update_delete" ON "audit"."logs";
--> statement-breakpoint
CREATE TRIGGER "logs_no_update_delete"
  BEFORE UPDATE OR DELETE ON "audit"."logs"
  FOR EACH ROW EXECUTE FUNCTION "audit"."prevent_logs_mutation"();
--> statement-breakpoint
DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE UPDATE, DELETE ON "audit"."logs" FROM "arena"';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'append-only audit.logs: REVOKE skipped (%)', SQLERRM;
  END;
END $$;
