ALTER TABLE "task" ADD COLUMN "parent_id" text;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "subtask_done" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "subtask_total" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_parent_id_task_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."task"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_parentId_idx" ON "task" USING btree ("parent_id");