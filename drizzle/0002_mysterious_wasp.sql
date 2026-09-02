CREATE TABLE "arena"."upload_intents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"submission_id" uuid NOT NULL,
	"requirement_id" uuid,
	"storage_key" text NOT NULL,
	"expected_mime_type" text NOT NULL,
	"expected_size_bytes" bigint NOT NULL,
	"original_filename" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "upload_intents_storage_key_unique" UNIQUE("storage_key"),
	CONSTRAINT "upload_intents_expected_size_positive_check" CHECK ("arena"."upload_intents"."expected_size_bytes" > 0)
);
--> statement-breakpoint
ALTER TABLE "arena"."upload_intents" ADD CONSTRAINT "upload_intents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena"."upload_intents" ADD CONSTRAINT "upload_intents_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "arena"."enrollments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena"."upload_intents" ADD CONSTRAINT "upload_intents_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "arena"."submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arena"."upload_intents" ADD CONSTRAINT "upload_intents_requirement_id_project_submission_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "arena"."project_submission_requirements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "upload_intents_enrollment_expiry_idx" ON "arena"."upload_intents" USING btree ("enrollment_id","expires_at");--> statement-breakpoint
CREATE INDEX "upload_intents_user_expiry_idx" ON "arena"."upload_intents" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "submission_versions_submission_id_review_attempt_unique" ON "arena"."submission_versions" USING btree ("submission_id","review_attempt_number") WHERE "arena"."submission_versions"."review_attempt_number" IS NOT NULL;