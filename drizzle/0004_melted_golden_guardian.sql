ALTER TYPE "arena"."review_status" ADD VALUE 'NEEDS_RESOLUTION' BEFORE 'PUBLISHED';--> statement-breakpoint
ALTER TABLE "arena"."reviews" DROP CONSTRAINT "reviews_submission_version_id_unique";--> statement-breakpoint
ALTER TABLE "arena"."reviews" ADD COLUMN "run_number" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "arena"."reviews" ADD CONSTRAINT "reviews_submission_version_run_unique" UNIQUE("submission_version_id","run_number");--> statement-breakpoint
ALTER TABLE "arena"."reviews" ADD CONSTRAINT "reviews_run_number_positive_check" CHECK ("arena"."reviews"."run_number" > 0);