-- External links on a task. The table is synced (see 0011); `project_id` repeats
-- the task's so the shape is scoped by membership without a join.
CREATE TABLE "task_link" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"project_id" text NOT NULL,
	"url" text NOT NULL,
	"title" text,
	"created_by" text,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "task_link" ADD CONSTRAINT "task_link_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_link" ADD CONSTRAINT "task_link_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_link" ADD CONSTRAINT "task_link_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "task_link_task_url_uidx" ON "task_link" USING btree ("task_id","url");--> statement-breakpoint
CREATE INDEX "task_link_projectId_idx" ON "task_link" USING btree ("project_id");
--> statement-breakpoint
ALTER TABLE "task_link" REPLICA IDENTITY FULL;--> statement-breakpoint
ALTER PUBLICATION electric_publication_default ADD TABLE "task_link";--> statement-breakpoint
GRANT SELECT ON "task_link" TO electric;
