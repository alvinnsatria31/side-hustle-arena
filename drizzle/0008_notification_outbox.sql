ALTER TABLE "notifications"."deliveries" ADD COLUMN "attempt_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications"."deliveries" ADD COLUMN "available_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications"."deliveries" ADD COLUMN "first_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notifications"."deliveries" ADD COLUMN "lease_token" uuid;--> statement-breakpoint
ALTER TABLE "notifications"."deliveries" ADD COLUMN "lease_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notifications"."deliveries" ADD COLUMN "message_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "notifications"."events" ADD COLUMN "dedupe_key" text;--> statement-breakpoint
CREATE INDEX "deliveries_email_queue_idx" ON "notifications"."deliveries" USING btree ("channel","status","available_at");--> statement-breakpoint
ALTER TABLE "notifications"."events" ADD CONSTRAINT "events_dedupe_key_unique" UNIQUE("dedupe_key");