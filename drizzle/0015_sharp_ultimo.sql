CREATE TYPE "arena"."project_resource_kind" AS ENUM('DATASET', 'DOCUMENT', 'TEMPLATE', 'LINK');--> statement-breakpoint
CREATE TABLE "arena"."project_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"label" text NOT NULL,
	"url" text NOT NULL,
	"kind" "arena"."project_resource_kind" DEFAULT 'LINK' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_resources_https_url_check" CHECK ("arena"."project_resources"."url" LIKE 'https://%'),
	CONSTRAINT "project_resources_sort_order_nonnegative_check" CHECK ("arena"."project_resources"."sort_order" >= 0)
);
--> statement-breakpoint
ALTER TABLE "arena"."project_resources" ADD CONSTRAINT "project_resources_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "arena"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_resources_project_id_idx" ON "arena"."project_resources" USING btree ("project_id");