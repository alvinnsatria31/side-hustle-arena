CREATE SCHEMA "ops";
--> statement-breakpoint
CREATE TABLE "ops"."feature_flags" (
	"key" text PRIMARY KEY NOT NULL,
	"maintenance_mode" boolean DEFAULT false NOT NULL,
	"message" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
