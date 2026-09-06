CREATE TABLE "arena"."review_artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_version_id" uuid NOT NULL,
	"source_id" text NOT NULL,
	"kind" text NOT NULL,
	"sha256" text NOT NULL,
	"extracted_text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_artifacts_version_source_unique" UNIQUE("submission_version_id","source_id")
);
--> statement-breakpoint
ALTER TABLE "arena"."review_scores" ADD COLUMN "evidence" jsonb;--> statement-breakpoint
ALTER TABLE "arena"."review_artifacts" ADD CONSTRAINT "review_artifacts_submission_version_id_submission_versions_id_fk" FOREIGN KEY ("submission_version_id") REFERENCES "arena"."submission_versions"("id") ON DELETE no action ON UPDATE no action;