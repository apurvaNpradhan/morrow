CREATE TABLE "task_description" (
	"task_id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"description" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "checklist_done" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "checklist_total" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "task_description" ADD CONSTRAINT "task_description_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_description" ADD CONSTRAINT "task_description_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_description_projectId_idx" ON "task_description" USING btree ("project_id");--> statement-breakpoint
-- Every existing task gets its description row (the column is dropped in 0017).
INSERT INTO "task_description" ("task_id", "project_id", "description")
SELECT "id", "project_id", "description" FROM "task";--> statement-breakpoint
-- Checklist progress, counted as `checklistCounts` does: task-list items at the
-- start of a line, ticked when the box holds an x.
UPDATE "task" SET "checklist_total" = counted."total", "checklist_done" = counted."done"
FROM (
  SELECT t."id", count(*) AS "total", count(*) FILTER (WHERE m."item"[1] <> ' ') AS "done"
  FROM "task" t,
    LATERAL regexp_matches(t."description", '^[ \t]*(?:[-*+]|[0-9]+[.)])[ \t]+\[([ xX])\]', 'gn') AS m("item")
  GROUP BY t."id"
) counted
WHERE "task"."id" = counted."id";--> statement-breakpoint
ALTER TABLE "task_description" REPLICA IDENTITY FULL;--> statement-breakpoint
ALTER PUBLICATION electric_publication_default ADD TABLE "task_description";--> statement-breakpoint
GRANT SELECT ON "task_description" TO electric;
