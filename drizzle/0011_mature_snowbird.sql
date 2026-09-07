CREATE TABLE "ops"."rate_limit_counters" (
	"bucket" text NOT NULL,
	"subject" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limit_counters_bucket_subject_window_start_pk" PRIMARY KEY("bucket","subject","window_start")
);
--> statement-breakpoint
CREATE INDEX "ops_rate_limit_window_idx" ON "ops"."rate_limit_counters" USING btree ("window_start");