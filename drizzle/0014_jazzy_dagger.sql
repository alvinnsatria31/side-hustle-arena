ALTER TABLE "identity"."users" ADD COLUMN "showcase_consent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "identity"."users" ADD COLUMN "showcase_consent_source" text;--> statement-breakpoint
ALTER TABLE "identity"."users" ADD COLUMN "deletion_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "identity"."users" ADD COLUMN "anonymized_at" timestamp with time zone;