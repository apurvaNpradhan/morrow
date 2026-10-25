ALTER TABLE "task" ADD COLUMN "recurrence" text;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_recurrence_needs_due_check" CHECK ("task"."recurrence" IS NULL OR "task"."due_at" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_recurrence_not_subtask_check" CHECK ("task"."recurrence" IS NULL OR "task"."parent_id" IS NULL);