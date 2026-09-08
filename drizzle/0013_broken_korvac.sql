CREATE TYPE "arena"."skill_evidence_attribution" AS ENUM('CRITERION', 'PROJECT');--> statement-breakpoint
ALTER TABLE "arena"."project_rubric_criteria" ADD COLUMN "skill_id" uuid;--> statement-breakpoint
ALTER TABLE "arena"."skill_evidence" ADD COLUMN "attribution" "arena"."skill_evidence_attribution" DEFAULT 'PROJECT' NOT NULL;--> statement-breakpoint
ALTER TABLE "arena"."skill_evidence" ADD COLUMN "criterion_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "arena"."project_rubric_criteria" ADD CONSTRAINT "project_rubric_criteria_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "arena"."skills"("id") ON DELETE set null ON UPDATE no action;