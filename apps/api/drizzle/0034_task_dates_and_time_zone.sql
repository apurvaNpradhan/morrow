ALTER TABLE "task" ADD COLUMN "due_at" timestamp;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "due_has_time" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "time_zone" text;--> statement-breakpoint
-- Every due date so far is a day: 00:00 UTC of it, without a time.
UPDATE "task" SET "due_at" = "due_date"::timestamp WHERE "due_date" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "task" DROP COLUMN "due_date";--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_due_has_time_check" CHECK ("task"."due_at" IS NOT NULL OR NOT "task"."due_has_time");