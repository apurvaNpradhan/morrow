-- Projects and their Columns. `position` is a fractional-index key, which only
-- sorts correctly by bytes, hence COLLATE "C". Both tables are synced (see 0011).
CREATE TABLE "project_column" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"color" text NOT NULL,
	"position" text COLLATE "C" NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "project_column_category_check" CHECK ("project_column"."category" IN ('backlog', 'unstarted', 'started', 'done', 'canceled'))
);
--> statement-breakpoint
CREATE TABLE "project" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"icon" text,
	"background_url" text,
	"archived_at" timestamp,
	"last_task_number" integer DEFAULT 0 NOT NULL,
	"position" text COLLATE "C" NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_column" ADD CONSTRAINT "project_column_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_column_projectId_idx" ON "project_column" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_column_project_name_uidx" ON "project_column" USING btree ("project_id",lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "project_column_position_uidx" ON "project_column" USING btree ("project_id","category","position");--> statement-breakpoint
CREATE UNIQUE INDEX "project_workspace_key_uidx" ON "project" USING btree ("workspace_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "project_workspace_position_uidx" ON "project" USING btree ("workspace_id","position");
--> statement-breakpoint
ALTER TABLE "project" REPLICA IDENTITY FULL;--> statement-breakpoint
ALTER TABLE "project_column" REPLICA IDENTITY FULL;--> statement-breakpoint
ALTER PUBLICATION electric_publication_default ADD TABLE "project", "project_column";--> statement-breakpoint
GRANT SELECT ON "project", "project_column" TO electric;--> statement-breakpoint
-- Roles are stored per workspace, so the new `project` permission has to be
-- added to the default "member" and "admin" rows that already exist (new
-- workspaces are seeded with it). A row that already has a `project` entry, a
-- custom role, or a row that is not a JSON object is left as it is.
DO $$
DECLARE
  role_row RECORD;
  parsed jsonb;
  grants jsonb;
BEGIN
  FOR role_row IN
    SELECT id, role, permission FROM "workspace_role" WHERE role IN ('member', 'admin')
  LOOP
    BEGIN
      parsed := role_row.permission::jsonb;
    EXCEPTION WHEN others THEN
      CONTINUE;
    END;
    IF jsonb_typeof(parsed) <> 'object' OR parsed ? 'project' THEN
      CONTINUE;
    END IF;
    grants := CASE role_row.role
      WHEN 'admin' THEN '["create", "update", "delete"]'::jsonb
      ELSE '["create", "update"]'::jsonb
    END;
    UPDATE "workspace_role"
    SET "permission" = jsonb_set(parsed, '{project}', grants)::text
    WHERE id = role_row.id;
  END LOOP;
END
$$;
