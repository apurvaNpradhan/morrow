-- Tasks. `position` is a fractional-index key (COLLATE "C", as in 0014). The table
-- is synced (see 0011).
CREATE TABLE "task" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"column_id" text NOT NULL,
	"number" integer NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"priority" text DEFAULT 'none' NOT NULL,
	"assignee_id" text,
	"due_date" date,
	"position" text COLLATE "C" NOT NULL,
	"completed_at" timestamp,
	"archived_at" timestamp,
	"created_by" text,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "task_priority_check" CHECK ("task"."priority" IN ('none', 'low', 'medium', 'high', 'urgent'))
);
--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_column_id_project_column_id_fk" FOREIGN KEY ("column_id") REFERENCES "public"."project_column"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_assignee_id_user_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_projectId_idx" ON "task" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "task_columnId_idx" ON "task" USING btree ("column_id");--> statement-breakpoint
CREATE INDEX "task_assigneeId_idx" ON "task" USING btree ("assignee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "task_project_number_uidx" ON "task" USING btree ("project_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "task_column_position_uidx" ON "task" USING btree ("column_id","position");
--> statement-breakpoint
ALTER TABLE "task" REPLICA IDENTITY FULL;--> statement-breakpoint
ALTER PUBLICATION electric_publication_default ADD TABLE "task";--> statement-breakpoint
GRANT SELECT ON "task" TO electric;--> statement-breakpoint
-- Better Auth removes members without any Morrow code in the transaction, so the
-- database clears the assignments of a member who leaves a Workspace, in the
-- same transaction as the removal.
CREATE FUNCTION "clear_task_assignments_of_removed_member"() RETURNS trigger AS $fn$
BEGIN
  UPDATE "task" SET "assignee_id" = NULL
  WHERE "assignee_id" = OLD."user_id"
    AND "project_id" IN (SELECT "id" FROM "project" WHERE "workspace_id" = OLD."workspace_id");
  RETURN OLD;
END
$fn$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER "workspace_member_clear_task_assignments"
BEFORE DELETE ON "workspace_member"
FOR EACH ROW EXECUTE FUNCTION "clear_task_assignments_of_removed_member"();--> statement-breakpoint
-- Roles are stored per workspace, so the new `task` permission has to be added
-- to the default "member" and "admin" rows that already exist (new workspaces
-- are seeded with it). A row that already has a `task` entry, a custom role, or
-- a row that is not a JSON object is left as it is.
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
    IF jsonb_typeof(parsed) <> 'object' OR parsed ? 'task' THEN
      CONTINUE;
    END IF;
    grants := CASE role_row.role
      WHEN 'admin' THEN '["create", "update", "delete", "assign"]'::jsonb
      ELSE '["create", "update"]'::jsonb
    END;
    UPDATE "workspace_role"
    SET "permission" = jsonb_set(parsed, '{task}', grants)::text
    WHERE id = role_row.id;
  END LOOP;
END
$$;
