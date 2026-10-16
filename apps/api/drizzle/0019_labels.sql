-- Workspace labels. `position` is a fractional-index key (COLLATE "C", as in 0014).
-- `task.label_ids` has no foreign key on purpose; label delete keeps it consistent.
CREATE TABLE "label" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"position" text COLLATE "C" NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "label_color_check" CHECK ("label"."color" IN ('gray', 'slate', 'red', 'orange', 'amber', 'green', 'teal', 'blue', 'violet', 'pink'))
);
--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "label_ids" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "label" ADD CONSTRAINT "label_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "label_workspaceId_idx" ON "label" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "label_workspace_name_uidx" ON "label" USING btree ("workspace_id",lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "label_workspace_position_uidx" ON "label" USING btree ("workspace_id","position");
--> statement-breakpoint
ALTER TABLE "label" REPLICA IDENTITY FULL;--> statement-breakpoint
ALTER PUBLICATION electric_publication_default ADD TABLE "label";--> statement-breakpoint
GRANT SELECT ON "label" TO electric;--> statement-breakpoint
-- Roles are stored per workspace, so the new `label` permission is added to the
-- default "member" (create) and "admin" (all) rows that already exist; new
-- workspaces are seeded with it. A row that already has a `label` entry, a
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
    IF jsonb_typeof(parsed) <> 'object' OR parsed ? 'label' THEN
      CONTINUE;
    END IF;
    grants := CASE role_row.role
      WHEN 'admin' THEN '["create", "update", "delete"]'::jsonb
      ELSE '["create"]'::jsonb
    END;
    UPDATE "workspace_role"
    SET "permission" = jsonb_set(parsed, '{label}', grants)::text
    WHERE id = role_row.id;
  END LOOP;
END
$$;
