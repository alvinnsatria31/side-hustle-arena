CREATE SCHEMA "arena";
--> statement-breakpoint
CREATE SCHEMA "audit";
--> statement-breakpoint
CREATE SCHEMA "automation";
--> statement-breakpoint
CREATE SCHEMA "identity";
--> statement-breakpoint
CREATE SCHEMA "notifications";
--> statement-breakpoint
CREATE SCHEMA "rewards";
--> statement-breakpoint
CREATE TYPE "arena"."access_status" AS ENUM('PENDING', 'CHECKING', 'ACCESSIBLE', 'FAILED', 'NOT_REQUIRED');--> statement-breakpoint
CREATE TYPE "audit"."audit_actor_type" AS ENUM('USER', 'ADMIN', 'AUTOMATION', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "automation"."automation_run_status" AS ENUM('PENDING', 'RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "automation"."automation_run_type" AS ENUM('PROJECT_GENERATION', 'PROJECT_PREVIEW', 'PROJECT_PUBLICATION', 'ACCESS_CHECK', 'AI_REVIEW', 'WEEK_CLOSE', 'WEEK_FINALIZATION', 'LEADERBOARD_GENERATION', 'POINT_DISTRIBUTION', 'NOTIFICATION_BROADCAST');--> statement-breakpoint
CREATE TYPE "notifications"."delivery_status" AS ENUM('PENDING', 'SENT', 'FAILED', 'SKIPPED');--> statement-breakpoint
CREATE TYPE "arena"."difficulty_band" AS ENUM('STANDARD');--> statement-breakpoint
CREATE TYPE "arena"."enrollment_status" AS ENUM('ACTIVE', 'SUBMITTED', 'UNDER_REVIEW', 'REVIEW_READY', 'COMPLETED', 'VOIDED');--> statement-breakpoint
CREATE TYPE "rewards"."inventory_mode" AS ENUM('UNLIMITED', 'LIMITED');--> statement-breakpoint
CREATE TYPE "arena"."leaderboard_scope" AS ENUM('GLOBAL');--> statement-breakpoint
CREATE TYPE "notifications"."notification_channel" AS ENUM('IN_APP', 'WEB_PUSH', 'EMAIL', 'WHATSAPP_COMMUNITY', 'DISCORD_COMMUNITY');--> statement-breakpoint
CREATE TYPE "notifications"."notification_type" AS ENUM('PROJECT_DROP', 'DEADLINE_REMINDER', 'SUBMISSION_RECEIVED', 'SUBMISSION_ACCESS_FAILED', 'RESULT_READY', 'POINTS_AWARDED', 'REWARD_REDEEMED', 'REWARD_FULFILLED');--> statement-breakpoint
CREATE TYPE "rewards"."point_ledger_entry_type" AS ENUM('WEEKLY_RANK', 'REWARD_REDEMPTION', 'ADMIN_ADJUSTMENT', 'ADMIN_REVERSAL');--> statement-breakpoint
CREATE TYPE "arena"."project_preview_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'REGENERATE_REQUESTED', 'AUTO_APPROVED');--> statement-breakpoint
CREATE TYPE "arena"."project_status" AS ENUM('DRAFT', 'PREVIEWED', 'SCHEDULED', 'PUBLISHED', 'REJECTED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "rewards"."redemption_status" AS ENUM('PENDING', 'PROCESSING', 'FULFILLED', 'FAILED', 'ADMIN_REVERSED');--> statement-breakpoint
CREATE TYPE "arena"."review_job_status" AS ENUM('PENDING', 'PROCESSING', 'RETRY', 'COMPLETED', 'FAILED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "arena"."review_status" AS ENUM('PROCESSING', 'COMPLETED_HIDDEN', 'PUBLISHED', 'FAILED', 'VOIDED');--> statement-breakpoint
CREATE TYPE "rewards"."reward_type" AS ENUM('DIGITAL', 'DISCOUNT', 'EVENT', 'MASTERCLASS', 'SERVICE', 'MONETARY');--> statement-breakpoint
CREATE TYPE "arena"."submission_requirement_type" AS ENUM('FILE', 'LINK', 'TEXT');--> statement-breakpoint
CREATE TYPE "arena"."submission_review_status" AS ENUM('NOT_QUEUED', 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "arena"."submission_status" AS ENUM('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'REVIEWED_HIDDEN', 'FINALIZED', 'VOIDED');--> statement-breakpoint
CREATE TYPE "arena"."tie_break_method" AS ENUM('EARLIEST_FINAL_SUBMISSION');--> statement-breakpoint
CREATE TYPE "identity"."user_status" AS ENUM('ACTIVE', 'SUSPENDED');--> statement-breakpoint
CREATE TYPE "arena"."week_status" AS ENUM('DRAFT', 'PREVIEW', 'SCHEDULED', 'OPEN', 'CLOSED', 'FINALIZING', 'FINALIZED', 'ARCHIVED', 'FAILED');--> statement-breakpoint
CREATE TYPE "arena"."workspace_step" AS ENUM('BRIEF', 'PLAN', 'WORK', 'REVIEW', 'SUBMIT');--> statement-breakpoint
CREATE TABLE "audit"."logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_type" "audit"."audit_actor_type" NOT NULL,
	"actor_subject" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"request_id" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "arena"."divisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "divisions_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "arena"."week_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"week_id" uuid NOT NULL,
	"max_projects_per_user" integer DEFAULT 1 NOT NULL,
	"max_review_attempts" integer DEFAULT 3 NOT NULL,
	"allow_late_submission" boolean DEFAULT false NOT NULL,
	"leaderboard_scope" "arena"."leaderboard_scope" DEFAULT 'GLOBAL' NOT NULL,
	"tie_break_method" "arena"."tie_break_method" DEFAULT 'EARLIEST_FINAL_SUBMISSION' NOT NULL,
	"rank_1_points" integer DEFAULT 300 NOT NULL,
	"rank_2_points" integer DEFAULT 200 NOT NULL,
	"rank_3_points" integer DEFAULT 150 NOT NULL,
	"completion_points" integer DEFAULT 100 NOT NULL,
	"difficulty_band" text DEFAULT 'STANDARD' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "week_rules_week_id_unique" UNIQUE("week_id"),
	CONSTRAINT "week_rules_max_projects_positive_check" CHECK ("arena"."week_rules"."max_projects_per_user" > 0),
	CONSTRAINT "week_rules_max_attempts_positive_check" CHECK ("arena"."week_rules"."max_review_attempts" > 0),
	CONSTRAINT "week_rules_points_nonnegative_check" CHECK ("arena"."week_rules"."rank_1_points" >= 0 AND "arena"."week_rules"."rank_2_points" >= 0 AND "arena"."week_rules"."rank_3_points" >= 0 AND "arena"."week_rules"."completion_points" >= 0)
);
--> statement-breakpoint
CREATE TABLE "arena"."weeks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"week_code" text NOT NULL,
	"title" text NOT NULL,
	"status" "arena"."week_status" DEFAULT 'DRAFT' NOT NULL,
	"preview_at" timestamp with time zone,
	"opens_at" timestamp with time zone NOT NULL,
	"submission_deadline_at" timestamp with time zone NOT NULL,
	"closed_at" timestamp with time zone,
	"finalization_started_at" timestamp with time zone,
	"finalized_at" timestamp with time zone,
	"timezone" text DEFAULT 'Asia/Jakarta' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "weeks_week_code_unique" UNIQUE("week_code"),
	CONSTRAINT "weeks_deadline_after_open_check" CHECK ("arena"."weeks"."submission_deadline_at" > "arena"."weeks"."opens_at")
);
--> statement-breakpoint
CREATE TABLE "automation"."runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "automation"."automation_run_type" NOT NULL,
	"week_id" uuid,
	"status" "automation"."automation_run_status" DEFAULT 'PENDING' NOT NULL,
	"idempotency_key" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"items_total" integer DEFAULT 0 NOT NULL,
	"items_success" integer DEFAULT 0 NOT NULL,
	"items_failed" integer DEFAULT 0 NOT NULL,
	"error_summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "runs_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "runs_counts_nonnegative_check" CHECK ("automation"."runs"."items_total" >= 0 AND "automation"."runs"."items_success" >= 0 AND "automation"."runs"."items_failed" >= 0)
);
--> statement-breakpoint
CREATE TABLE "identity"."users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_subject" text NOT NULL,
	"email_cache" text,
	"display_name_cache" text,
	"avatar_url_cache" text,
	"status" "identity"."user_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone,
	CONSTRAINT "users_auth_subject_unique" UNIQUE("auth_subject")
);
--> statement-breakpoint
CREATE TABLE "notifications"."deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"channel" "notifications"."notification_channel" NOT NULL,
	"status" "notifications"."delivery_status" DEFAULT 'PENDING' NOT NULL,
	"provider_reference" text,
	"sent_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications"."events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "notifications"."notification_type" NOT NULL,
	"user_id" uuid,
	"week_id" uuid,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"action_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "arena"."project_rubric_criteria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"weight" numeric NOT NULL,
	"max_score" numeric NOT NULL,
	"review_instruction" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rubric_criteria_positive_values_check" CHECK ("arena"."project_rubric_criteria"."weight" > 0 AND "arena"."project_rubric_criteria"."max_score" > 0 AND "arena"."project_rubric_criteria"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "arena"."project_skills" (
	"project_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"weight" numeric,
	CONSTRAINT "project_skills_project_id_skill_id_unique" UNIQUE("project_id","skill_id"),
	CONSTRAINT "project_skills_weight_nonnegative_check" CHECK ("arena"."project_skills"."weight" IS NULL OR "arena"."project_skills"."weight" >= 0)
);
--> statement-breakpoint
CREATE TABLE "arena"."project_submission_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"label" text NOT NULL,
	"type" "arena"."submission_requirement_type" NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"min_items" integer DEFAULT 0 NOT NULL,
	"max_items" integer DEFAULT 1 NOT NULL,
	"allowed_mime_types" text[],
	"allowed_link_types" text[],
	"instructions" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "submission_requirements_item_bounds_check" CHECK ("arena"."project_submission_requirements"."min_items" >= 0 AND "arena"."project_submission_requirements"."max_items" >= 0 AND "arena"."project_submission_requirements"."max_items" >= "arena"."project_submission_requirements"."min_items" AND "arena"."project_submission_requirements"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "arena"."projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"week_id" uuid NOT NULL,
	"division_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"short_description" text,
	"difficulty" "arena"."difficulty_band" DEFAULT 'STANDARD' NOT NULL,
	"case_background" text,
	"role_description" text,
	"mission" text,
	"objective" text,
	"estimated_minutes" integer,
	"status" "arena"."project_status" DEFAULT 'DRAFT' NOT NULL,
	"scheduled_publish_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"preview_status" "arena"."project_preview_status" DEFAULT 'PENDING' NOT NULL,
	"discord_preview_message_id" text,
	"automation_run_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_week_id_slug_unique" UNIQUE("week_id","slug"),
	CONSTRAINT "projects_estimated_minutes_positive_check" CHECK ("arena"."projects"."estimated_minutes" IS NULL OR "arena"."projects"."estimated_minutes" > 0)
);
--> statement-breakpoint
CREATE TABLE "arena"."skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "skills_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "arena"."weekly_rankings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"week_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"submission_version_id" uuid NOT NULL,
	"review_id" uuid NOT NULL,
	"final_score" numeric NOT NULL,
	"final_submitted_at" timestamp with time zone NOT NULL,
	"rank" integer NOT NULL,
	"points_awarded" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "weekly_rankings_week_id_user_id_unique" UNIQUE("week_id","user_id"),
	CONSTRAINT "weekly_rankings_week_id_rank_unique" UNIQUE("week_id","rank"),
	CONSTRAINT "weekly_rankings_values_check" CHECK ("arena"."weekly_rankings"."rank" > 0 AND "arena"."weekly_rankings"."final_score" >= 0 AND "arena"."weekly_rankings"."final_score" <= 100 AND "arena"."weekly_rankings"."points_awarded" >= 0)
);
--> statement-breakpoint
CREATE TABLE "rewards"."catalog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"points_cost" integer NOT NULL,
	"reward_type" "rewards"."reward_type" NOT NULL,
	"monetary_value_minor" integer,
	"currency" text,
	"inventory_mode" "rewards"."inventory_mode" DEFAULT 'UNLIMITED' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_slug_unique" UNIQUE("slug"),
	CONSTRAINT "catalog_cost_and_value_check" CHECK ("rewards"."catalog"."points_cost" > 0 AND ("rewards"."catalog"."monetary_value_minor" IS NULL OR "rewards"."catalog"."monetary_value_minor" >= 0))
);
--> statement-breakpoint
CREATE TABLE "rewards"."inventory_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reward_id" uuid NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"quantity_total" integer NOT NULL,
	"quantity_reserved" integer DEFAULT 0 NOT NULL,
	"quantity_fulfilled" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_periods_values_check" CHECK ("rewards"."inventory_periods"."period_end" > "rewards"."inventory_periods"."period_start" AND "rewards"."inventory_periods"."quantity_total" >= 0 AND "rewards"."inventory_periods"."quantity_reserved" >= 0 AND "rewards"."inventory_periods"."quantity_fulfilled" >= 0 AND "rewards"."inventory_periods"."quantity_reserved" <= "rewards"."inventory_periods"."quantity_total" AND "rewards"."inventory_periods"."quantity_fulfilled" <= "rewards"."inventory_periods"."quantity_total")
);
--> statement-breakpoint
CREATE TABLE "rewards"."point_accounts" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"lifetime_earned" integer DEFAULT 0 NOT NULL,
	"lifetime_spent" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "point_accounts_nonnegative_check" CHECK ("rewards"."point_accounts"."balance" >= 0 AND "rewards"."point_accounts"."lifetime_earned" >= 0 AND "rewards"."point_accounts"."lifetime_spent" >= 0)
);
--> statement-breakpoint
CREATE TABLE "rewards"."point_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"entry_type" "rewards"."point_ledger_entry_type" NOT NULL,
	"week_id" uuid,
	"reference_type" text,
	"reference_id" text,
	"description" text,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "point_ledger_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "rewards"."redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"reward_id" uuid NOT NULL,
	"inventory_period_id" uuid,
	"points_spent" integer NOT NULL,
	"status" "rewards"."redemption_status" DEFAULT 'PENDING' NOT NULL,
	"idempotency_key" text NOT NULL,
	"redeemed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"fulfilled_at" timestamp with time zone,
	"fulfillment_reference" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "redemptions_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "redemptions_points_spent_positive_check" CHECK ("rewards"."redemptions"."points_spent" > 0)
);
--> statement-breakpoint
CREATE TABLE "arena"."review_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_version_id" uuid NOT NULL,
	"status" "arena"."review_job_status" DEFAULT 'PENDING' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_by" text,
	"lease_expires_at" timestamp with time zone,
	"last_error_code" text,
	"last_error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_jobs_submission_version_id_unique" UNIQUE("submission_version_id"),
	CONSTRAINT "review_jobs_attempt_count_nonnegative_check" CHECK ("arena"."review_jobs"."attempt_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "arena"."review_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"admin_subject" text NOT NULL,
	"previous_score" numeric,
	"new_score" numeric NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_overrides_score_range_check" CHECK (("arena"."review_overrides"."previous_score" IS NULL OR ("arena"."review_overrides"."previous_score" >= 0 AND "arena"."review_overrides"."previous_score" <= 100)) AND "arena"."review_overrides"."new_score" >= 0 AND "arena"."review_overrides"."new_score" <= 100)
);
--> statement-breakpoint
CREATE TABLE "arena"."review_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"review_id" uuid NOT NULL,
	"rubric_criterion_id" uuid NOT NULL,
	"raw_score" numeric NOT NULL,
	"max_score" numeric NOT NULL,
	"weighted_score" numeric NOT NULL,
	"feedback" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_scores_review_id_rubric_criterion_id_unique" UNIQUE("review_id","rubric_criterion_id"),
	CONSTRAINT "review_scores_valid_values_check" CHECK ("arena"."review_scores"."raw_score" >= 0 AND "arena"."review_scores"."max_score" > 0 AND "arena"."review_scores"."weighted_score" >= 0)
);
--> statement-breakpoint
CREATE TABLE "arena"."reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_version_id" uuid NOT NULL,
	"automation_run_id" uuid,
	"status" "arena"."review_status" DEFAULT 'PROCESSING' NOT NULL,
	"ai_score" numeric,
	"final_score" numeric,
	"summary" text,
	"strengths" jsonb,
	"improvements" jsonb,
	"review_confidence" numeric,
	"review_model" text,
	"review_model_version" text,
	"prompt_version" text,
	"reviewed_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_submission_version_id_unique" UNIQUE("submission_version_id"),
	CONSTRAINT "reviews_score_range_check" CHECK (("arena"."reviews"."ai_score" IS NULL OR ("arena"."reviews"."ai_score" >= 0 AND "arena"."reviews"."ai_score" <= 100)) AND ("arena"."reviews"."final_score" IS NULL OR ("arena"."reviews"."final_score" >= 0 AND "arena"."reviews"."final_score" <= 100)) AND ("arena"."reviews"."review_confidence" IS NULL OR ("arena"."reviews"."review_confidence" >= 0 AND "arena"."reviews"."review_confidence" <= 1)))
);
--> statement-breakpoint
CREATE TABLE "arena"."skill_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"week_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"review_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"score" numeric NOT NULL,
	"evidence_summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "skill_evidence_review_id_skill_id_unique" UNIQUE("review_id","skill_id"),
	CONSTRAINT "skill_evidence_score_range_check" CHECK ("arena"."skill_evidence"."score" >= 0 AND "arena"."skill_evidence"."score" <= 100)
);
--> statement-breakpoint
CREATE TABLE "arena"."enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"week_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"status" "arena"."enrollment_status" DEFAULT 'ACTIVE' NOT NULL,
	"selected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enrollments_user_id_week_id_unique" UNIQUE("user_id","week_id")
);
--> statement-breakpoint
CREATE TABLE "arena"."submission_draft_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"requirement_id" uuid,
	"item_type" "arena"."submission_requirement_type" NOT NULL,
	"label" text,
	"storage_key" text,
	"external_url" text,
	"original_filename" text,
	"mime_type" text,
	"file_size_bytes" bigint,
	"checksum" text,
	"text_content" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "submission_draft_items_size_nonnegative_check" CHECK ("arena"."submission_draft_items"."file_size_bytes" IS NULL OR "arena"."submission_draft_items"."file_size_bytes" >= 0)
);
--> statement-breakpoint
CREATE TABLE "arena"."submission_version_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_version_id" uuid NOT NULL,
	"requirement_id" uuid,
	"item_type" "arena"."submission_requirement_type" NOT NULL,
	"label" text,
	"storage_key" text,
	"external_url" text,
	"original_filename" text,
	"mime_type" text,
	"file_size_bytes" bigint,
	"checksum" text,
	"text_content" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "submission_version_items_size_nonnegative_check" CHECK ("arena"."submission_version_items"."file_size_bytes" IS NULL OR "arena"."submission_version_items"."file_size_bytes" >= 0)
);
--> statement-breakpoint
CREATE TABLE "arena"."submission_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"explanation" text,
	"notes" text,
	"submitted_at" timestamp with time zone NOT NULL,
	"access_status" "arena"."access_status" DEFAULT 'PENDING' NOT NULL,
	"review_attempt_number" integer,
	"review_status" "arena"."submission_review_status" DEFAULT 'NOT_QUEUED' NOT NULL,
	"is_final" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "submission_versions_submission_id_version_number_unique" UNIQUE("submission_id","version_number"),
	CONSTRAINT "submission_versions_numbers_positive_check" CHECK ("arena"."submission_versions"."version_number" > 0 AND ("arena"."submission_versions"."review_attempt_number" IS NULL OR "arena"."submission_versions"."review_attempt_number" > 0))
);
--> statement-breakpoint
CREATE TABLE "arena"."submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"week_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"status" "arena"."submission_status" DEFAULT 'DRAFT' NOT NULL,
	"draft_explanation" text,
	"draft_notes" text,
	"review_attempts_used" integer DEFAULT 0 NOT NULL,
	"latest_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "submissions_enrollment_id_unique" UNIQUE("enrollment_id"),
	CONSTRAINT "submissions_review_attempts_nonnegative_check" CHECK ("arena"."submissions"."review_attempts_used" >= 0)
);
--> statement-breakpoint
CREATE TABLE "arena"."workspace_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"current_step" "arena"."workspace_step" DEFAULT 'BRIEF' NOT NULL,
	"plan_text" text,
	"tools" jsonb,
	"task_breakdown" jsonb,
	"notes" text,
	"review_checklist" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_progress_enrollment_id_unique" UNIQUE("enrollment_id")
);
--> statement-breakpoint
ALTER TABLE "arena"."week_rules" ADD CONSTRAINT "week_rules_week_id_weeks_id_fk" FOREIGN KEY ("week_id") REFERENCES "arena"."weeks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation"."runs" ADD CONSTRAINT "runs_week_id_weeks_id_fk" FOREIGN KEY ("week_id") REFERENCES "arena"."weeks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications"."deliveries" ADD CONSTRAINT "deliveries_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "notifications"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications"."events" ADD CONSTRAINT "events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications"."events" ADD CONSTRAINT "events_week_id_weeks_id_fk" FOREIGN KEY ("week_id") REFERENCES "arena"."weeks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena"."project_rubric_criteria" ADD CONSTRAINT "project_rubric_criteria_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "arena"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena"."project_skills" ADD CONSTRAINT "project_skills_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "arena"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena"."project_skills" ADD CONSTRAINT "project_skills_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "arena"."skills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena"."project_submission_requirements" ADD CONSTRAINT "project_submission_requirements_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "arena"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena"."projects" ADD CONSTRAINT "projects_week_id_weeks_id_fk" FOREIGN KEY ("week_id") REFERENCES "arena"."weeks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena"."projects" ADD CONSTRAINT "projects_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "arena"."divisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena"."projects" ADD CONSTRAINT "projects_automation_run_id_runs_id_fk" FOREIGN KEY ("automation_run_id") REFERENCES "automation"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena"."weekly_rankings" ADD CONSTRAINT "weekly_rankings_week_id_weeks_id_fk" FOREIGN KEY ("week_id") REFERENCES "arena"."weeks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena"."weekly_rankings" ADD CONSTRAINT "weekly_rankings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena"."weekly_rankings" ADD CONSTRAINT "weekly_rankings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "arena"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena"."weekly_rankings" ADD CONSTRAINT "weekly_rankings_submission_version_id_submission_versions_id_fk" FOREIGN KEY ("submission_version_id") REFERENCES "arena"."submission_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena"."weekly_rankings" ADD CONSTRAINT "weekly_rankings_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "arena"."reviews"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewards"."inventory_periods" ADD CONSTRAINT "inventory_periods_reward_id_catalog_id_fk" FOREIGN KEY ("reward_id") REFERENCES "rewards"."catalog"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewards"."point_accounts" ADD CONSTRAINT "point_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewards"."point_ledger" ADD CONSTRAINT "point_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewards"."point_ledger" ADD CONSTRAINT "point_ledger_week_id_weeks_id_fk" FOREIGN KEY ("week_id") REFERENCES "arena"."weeks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewards"."redemptions" ADD CONSTRAINT "redemptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewards"."redemptions" ADD CONSTRAINT "redemptions_reward_id_catalog_id_fk" FOREIGN KEY ("reward_id") REFERENCES "rewards"."catalog"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewards"."redemptions" ADD CONSTRAINT "redemptions_inventory_period_id_inventory_periods_id_fk" FOREIGN KEY ("inventory_period_id") REFERENCES "rewards"."inventory_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena"."review_jobs" ADD CONSTRAINT "review_jobs_submission_version_id_submission_versions_id_fk" FOREIGN KEY ("submission_version_id") REFERENCES "arena"."submission_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena"."review_overrides" ADD CONSTRAINT "review_overrides_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "arena"."reviews"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena"."review_scores" ADD CONSTRAINT "review_scores_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "arena"."reviews"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena"."review_scores" ADD CONSTRAINT "review_scores_rubric_criterion_id_project_rubric_criteria_id_fk" FOREIGN KEY ("rubric_criterion_id") REFERENCES "arena"."project_rubric_criteria"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena"."reviews" ADD CONSTRAINT "reviews_submission_version_id_submission_versions_id_fk" FOREIGN KEY ("submission_version_id") REFERENCES "arena"."submission_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena"."reviews" ADD CONSTRAINT "reviews_automation_run_id_runs_id_fk" FOREIGN KEY ("automation_run_id") REFERENCES "automation"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena"."skill_evidence" ADD CONSTRAINT "skill_evidence_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena"."skill_evidence" ADD CONSTRAINT "skill_evidence_week_id_weeks_id_fk" FOREIGN KEY ("week_id") REFERENCES "arena"."weeks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena"."skill_evidence" ADD CONSTRAINT "skill_evidence_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "arena"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena"."skill_evidence" ADD CONSTRAINT "skill_evidence_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "arena"."reviews"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena"."skill_evidence" ADD CONSTRAINT "skill_evidence_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "arena"."skills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena"."enrollments" ADD CONSTRAINT "enrollments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena"."enrollments" ADD CONSTRAINT "enrollments_week_id_weeks_id_fk" FOREIGN KEY ("week_id") REFERENCES "arena"."weeks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena"."enrollments" ADD CONSTRAINT "enrollments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "arena"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena"."submission_draft_items" ADD CONSTRAINT "submission_draft_items_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "arena"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena"."submission_draft_items" ADD CONSTRAINT "submission_draft_items_requirement_id_project_submission_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "arena"."project_submission_requirements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena"."submission_version_items" ADD CONSTRAINT "submission_version_items_submission_version_id_submission_versions_id_fk" FOREIGN KEY ("submission_version_id") REFERENCES "arena"."submission_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena"."submission_version_items" ADD CONSTRAINT "submission_version_items_requirement_id_project_submission_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "arena"."project_submission_requirements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena"."submission_versions" ADD CONSTRAINT "submission_versions_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "arena"."submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena"."submissions" ADD CONSTRAINT "submissions_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "arena"."enrollments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena"."submissions" ADD CONSTRAINT "submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena"."submissions" ADD CONSTRAINT "submissions_week_id_weeks_id_fk" FOREIGN KEY ("week_id") REFERENCES "arena"."weeks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena"."submissions" ADD CONSTRAINT "submissions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "arena"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena"."workspace_progress" ADD CONSTRAINT "workspace_progress_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "arena"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "weeks_status_opens_idx" ON "arena"."weeks" USING btree ("status","opens_at");--> statement-breakpoint
CREATE INDEX "runs_type_status_idx" ON "automation"."runs" USING btree ("type","status");--> statement-breakpoint
CREATE INDEX "deliveries_status_idx" ON "notifications"."deliveries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "projects_week_status_idx" ON "arena"."projects" USING btree ("week_id","status");--> statement-breakpoint
CREATE INDEX "projects_division_id_idx" ON "arena"."projects" USING btree ("division_id");--> statement-breakpoint
CREATE INDEX "weekly_rankings_week_rank_idx" ON "arena"."weekly_rankings" USING btree ("week_id","rank");--> statement-breakpoint
CREATE INDEX "weekly_rankings_leaderboard_idx" ON "arena"."weekly_rankings" USING btree ("week_id","final_score","final_submitted_at");--> statement-breakpoint
CREATE INDEX "point_ledger_user_created_idx" ON "rewards"."point_ledger" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "redemptions_user_status_idx" ON "rewards"."redemptions" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "review_jobs_claim_idx" ON "arena"."review_jobs" USING btree ("status","priority" desc,"available_at");--> statement-breakpoint
CREATE INDEX "reviews_status_idx" ON "arena"."reviews" USING btree ("status");--> statement-breakpoint
CREATE INDEX "skill_evidence_user_created_idx" ON "arena"."skill_evidence" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "skill_evidence_skill_id_idx" ON "arena"."skill_evidence" USING btree ("skill_id");--> statement-breakpoint
CREATE INDEX "skill_evidence_review_id_idx" ON "arena"."skill_evidence" USING btree ("review_id");--> statement-breakpoint
CREATE INDEX "enrollments_project_id_idx" ON "arena"."enrollments" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "submission_versions_submission_submitted_idx" ON "arena"."submission_versions" USING btree ("submission_id","submitted_at");--> statement-breakpoint
CREATE INDEX "submissions_user_week_idx" ON "arena"."submissions" USING btree ("user_id","week_id");