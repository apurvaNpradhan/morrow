ALTER TABLE "project_field" DROP CONSTRAINT "project_field_type_check";--> statement-breakpoint
ALTER TABLE "project_field" ADD COLUMN "config" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "project_field" ADD CONSTRAINT "project_field_type_check" CHECK ("project_field"."type" IN ('single_choice', 'multi_choice', 'text', 'number', 'date', 'checkbox'));