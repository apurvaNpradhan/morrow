-- Custom Fields. `position` is a fractional-index key (COLLATE "C", as in 0014).
-- `task.field_values` holds a value per Field id; a value not set is a missing
-- key. `project_field` is synced (see 0011).
CREATE TABLE "project_field" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"position" text COLLATE "C" NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "project_field_type_check" CHECK ("project_field"."type" IN ('single_choice'))
);
--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "field_values" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "project_field" ADD CONSTRAINT "project_field_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_field_projectId_idx" ON "project_field" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_field_project_name_uidx" ON "project_field" USING btree ("project_id",lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "project_field_position_uidx" ON "project_field" USING btree ("project_id","position");--> statement-breakpoint
ALTER TABLE "project_field" REPLICA IDENTITY FULL;--> statement-breakpoint
ALTER PUBLICATION electric_publication_default ADD TABLE "project_field";--> statement-breakpoint
GRANT SELECT ON "project_field" TO electric;
