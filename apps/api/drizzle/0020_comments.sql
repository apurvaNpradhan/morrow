-- Task comments. `comment_count` is kept by the Procedures that create and delete
-- them. The table is synced (see 0011); `project_id` repeats the task's so the
-- shape is scoped by membership without a join.
CREATE TABLE "task_comment" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"project_id" text NOT NULL,
	"author_id" text,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	"edited_at" timestamp,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "comment_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "task_comment" ADD CONSTRAINT "task_comment_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comment" ADD CONSTRAINT "task_comment_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comment" ADD CONSTRAINT "task_comment_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_comment_task_created_idx" ON "task_comment" USING btree ("task_id","created_at");--> statement-breakpoint
CREATE INDEX "task_comment_projectId_idx" ON "task_comment" USING btree ("project_id");
--> statement-breakpoint
ALTER TABLE "task_comment" REPLICA IDENTITY FULL;--> statement-breakpoint
ALTER PUBLICATION electric_publication_default ADD TABLE "task_comment";--> statement-breakpoint
GRANT SELECT ON "task_comment" TO electric;--> statement-breakpoint
-- Roles are stored per workspace, so the new `comment` permission is added to
-- the default "viewer" and "member" (create) and "admin" (create, delete) rows
-- that already exist; new workspaces are seeded with it. A row that already has
-- a `comment` entry, a custom role, or a row that is not a JSON object is left
-- as it is.
DO $$
DECLARE
  role_row RECORD;
  parsed jsonb;
  grants jsonb;
BEGIN
  FOR role_row IN
    SELECT id, role, permission FROM "workspace_role" WHERE role IN ('viewer', 'member', 'admin')
  LOOP
    BEGIN
      parsed := role_row.permission::jsonb;
    EXCEPTION WHEN others THEN
      CONTINUE;
    END;
    IF jsonb_typeof(parsed) <> 'object' OR parsed ? 'comment' THEN
      CONTINUE;
    END IF;
    grants := CASE role_row.role
      WHEN 'admin' THEN '["create", "delete"]'::jsonb
      ELSE '["create"]'::jsonb
    END;
    UPDATE "workspace_role"
    SET "permission" = jsonb_set(parsed, '{comment}', grants)::text
    WHERE id = role_row.id;
  END LOOP;
END
$$;
