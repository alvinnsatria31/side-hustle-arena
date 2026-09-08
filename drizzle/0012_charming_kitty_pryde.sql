CREATE TYPE "arena"."job_employment_type" AS ENUM('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'FREELANCE', 'TEMPORARY', 'UNSPECIFIED');--> statement-breakpoint
CREATE TYPE "arena"."job_opening_status" AS ENUM('OPEN', 'EXPIRED', 'STALE', 'CLOSED');--> statement-breakpoint
CREATE TYPE "arena"."job_skill_kind" AS ENUM('REQUIRED', 'PREFERRED');--> statement-breakpoint
CREATE TYPE "arena"."job_sync_status" AS ENUM('RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED');--> statement-breakpoint
CREATE TYPE "arena"."job_work_mode" AS ENUM('REMOTE', 'HYBRID', 'ONSITE', 'UNSPECIFIED');--> statement-breakpoint
CREATE TABLE "arena"."job_opening_skills" (
	"job_opening_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"kind" "arena"."job_skill_kind" NOT NULL,
	"matched_alias" text NOT NULL,
	CONSTRAINT "job_opening_skills_opening_skill_kind_unique" UNIQUE("job_opening_id","skill_id","kind")
);
--> statement-breakpoint
CREATE TABLE "arena"."job_openings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"canonical_key" text NOT NULL,
	"title" text NOT NULL,
	"company" text NOT NULL,
	"location" text,
	"work_mode" "arena"."job_work_mode" DEFAULT 'UNSPECIFIED' NOT NULL,
	"employment_type" "arena"."job_employment_type" DEFAULT 'UNSPECIFIED' NOT NULL,
	"description" text,
	"required_skills" text[] DEFAULT '{}'::text[] NOT NULL,
	"preferred_skills" text[] DEFAULT '{}'::text[] NOT NULL,
	"application_url" text NOT NULL,
	"posted_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"salary_min" bigint,
	"salary_max" bigint,
	"salary_currency" text,
	"salary_period" text,
	"status" "arena"."job_opening_status" DEFAULT 'OPEN' NOT NULL,
	"content_hash" text NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_openings_source_id_external_id_unique" UNIQUE("source_id","external_id"),
	CONSTRAINT "job_openings_salary_range_check" CHECK ("arena"."job_openings"."salary_min" IS NULL OR "arena"."job_openings"."salary_max" IS NULL OR "arena"."job_openings"."salary_min" <= "arena"."job_openings"."salary_max"),
	CONSTRAINT "job_openings_application_url_https_check" CHECK ("arena"."job_openings"."application_url" LIKE 'https://%')
);
--> statement-breakpoint
CREATE TABLE "arena"."job_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"adapter" text NOT NULL,
	"config" jsonb NOT NULL,
	"credential_env_var" text,
	"is_active" boolean DEFAULT false NOT NULL,
	"sync_interval_minutes" integer DEFAULT 360 NOT NULL,
	"staleness_days" integer DEFAULT 7 NOT NULL,
	"cursor" text,
	"last_sync_started_at" timestamp with time zone,
	"last_successful_sync_at" timestamp with time zone,
	"last_failure_at" timestamp with time zone,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"last_error_code" text,
	"last_error_message" text,
	"lease_token" uuid,
	"lease_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_sources_slug_unique" UNIQUE("slug"),
	CONSTRAINT "job_sources_interval_positive_check" CHECK ("arena"."job_sources"."sync_interval_minutes" > 0 AND "arena"."job_sources"."staleness_days" > 0),
	CONSTRAINT "job_sources_failures_nonnegative_check" CHECK ("arena"."job_sources"."consecutive_failures" >= 0)
);
--> statement-breakpoint
CREATE TABLE "arena"."job_sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"status" "arena"."job_sync_status" DEFAULT 'RUNNING' NOT NULL,
	"triggered_by" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"cursor_before" text,
	"cursor_after" text,
	"pages_fetched" integer DEFAULT 0 NOT NULL,
	"items_seen" integer DEFAULT 0 NOT NULL,
	"items_created" integer DEFAULT 0 NOT NULL,
	"items_updated" integer DEFAULT 0 NOT NULL,
	"items_unchanged" integer DEFAULT 0 NOT NULL,
	"items_invalid" integer DEFAULT 0 NOT NULL,
	"items_closed" integer DEFAULT 0 NOT NULL,
	"error_code" text,
	"error_message" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "job_sync_runs_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "arena"."skill_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"skill_id" uuid NOT NULL,
	"alias" text NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "skill_aliases_alias_unique" UNIQUE("alias")
);
--> statement-breakpoint
ALTER TABLE "arena"."job_opening_skills" ADD CONSTRAINT "job_opening_skills_job_opening_id_job_openings_id_fk" FOREIGN KEY ("job_opening_id") REFERENCES "arena"."job_openings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena"."job_opening_skills" ADD CONSTRAINT "job_opening_skills_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "arena"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena"."job_openings" ADD CONSTRAINT "job_openings_source_id_job_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "arena"."job_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena"."job_sync_runs" ADD CONSTRAINT "job_sync_runs_source_id_job_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "arena"."job_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena"."skill_aliases" ADD CONSTRAINT "skill_aliases_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "arena"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "job_opening_skills_skill_idx" ON "arena"."job_opening_skills" USING btree ("skill_id");--> statement-breakpoint
CREATE INDEX "job_openings_status_seen_idx" ON "arena"."job_openings" USING btree ("status","last_seen_at");--> statement-breakpoint
CREATE INDEX "job_openings_canonical_key_idx" ON "arena"."job_openings" USING btree ("canonical_key");--> statement-breakpoint
CREATE INDEX "job_openings_source_seen_idx" ON "arena"."job_openings" USING btree ("source_id","last_seen_at");--> statement-breakpoint
CREATE INDEX "job_sources_active_idx" ON "arena"."job_sources" USING btree ("is_active","last_successful_sync_at");--> statement-breakpoint
CREATE INDEX "job_sync_runs_source_started_idx" ON "arena"."job_sync_runs" USING btree ("source_id","started_at");--> statement-breakpoint
CREATE INDEX "skill_aliases_skill_idx" ON "arena"."skill_aliases" USING btree ("skill_id");