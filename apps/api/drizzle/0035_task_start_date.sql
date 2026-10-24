ALTER TABLE "task" ADD COLUMN "start_at" timestamp;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "start_has_time" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_start_has_time_check" CHECK ("task"."start_at" IS NOT NULL OR NOT "task"."start_has_time");--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_start_before_due_check" CHECK ("task"."start_at" IS NULL OR "task"."due_at" IS NULL OR "task"."start_at" <= "task"."due_at");