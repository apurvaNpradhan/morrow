-- Task history. `data` is the payload of `type` (see `taskEventSchema`); no
-- backfill, so existing tasks start with an empty history. The table is synced
-- (see 0011); `project_id` repeats the task's for shape scoping.
CREATE TABLE "task_event" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"project_id" text NOT NULL,
	"actor_id" text,
	"type" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "task_event" ADD CONSTRAINT "task_event_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_event" ADD CONSTRAINT "task_event_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_event" ADD CONSTRAINT "task_event_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_event_task_created_idx" ON "task_event" USING btree ("task_id","created_at");--> statement-breakpoint
CREATE INDEX "task_event_projectId_idx" ON "task_event" USING btree ("project_id");
--> statement-breakpoint
ALTER TABLE "task_event" REPLICA IDENTITY FULL;--> statement-breakpoint
ALTER PUBLICATION electric_publication_default ADD TABLE "task_event";--> statement-breakpoint
GRANT SELECT ON "task_event" TO electric;
