-- Relations between tasks (blocks, related, duplicate). The table is synced (see 0011);
-- `workspace_id` scopes the shape by membership without a join.
CREATE TABLE "task_relation" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"type" text NOT NULL,
	"source_task_id" text NOT NULL,
	"target_task_id" text NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "task_relation_type_check" CHECK ("task_relation"."type" IN ('blocks', 'related', 'duplicate')),
	CONSTRAINT "task_relation_distinct_check" CHECK ("task_relation"."source_task_id" <> "task_relation"."target_task_id")
);
--> statement-breakpoint
ALTER TABLE "task_relation" ADD CONSTRAINT "task_relation_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_relation" ADD CONSTRAINT "task_relation_source_task_id_task_id_fk" FOREIGN KEY ("source_task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_relation" ADD CONSTRAINT "task_relation_target_task_id_task_id_fk" FOREIGN KEY ("target_task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_relation" ADD CONSTRAINT "task_relation_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "task_relation_type_source_target_uidx" ON "task_relation" USING btree ("type","source_task_id","target_task_id");--> statement-breakpoint
CREATE INDEX "task_relation_sourceTaskId_idx" ON "task_relation" USING btree ("source_task_id");--> statement-breakpoint
CREATE INDEX "task_relation_targetTaskId_idx" ON "task_relation" USING btree ("target_task_id");--> statement-breakpoint
CREATE INDEX "task_relation_workspaceId_idx" ON "task_relation" USING btree ("workspace_id");--> statement-breakpoint
ALTER TABLE "task_relation" REPLICA IDENTITY FULL;--> statement-breakpoint
ALTER PUBLICATION electric_publication_default ADD TABLE "task_relation";--> statement-breakpoint
GRANT SELECT ON "task_relation" TO electric;
