ALTER TABLE "account" ALTER COLUMN "created_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE "activity" ALTER COLUMN "updated_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE "asset" ALTER COLUMN "created_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE "data_migration" ALTER COLUMN "completed_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE "invitation" ALTER COLUMN "created_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE "workspace_role" ALTER COLUMN "created_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE "workspace_role" ALTER COLUMN "updated_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE "session" ALTER COLUMN "created_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE "storage_cleanup" ALTER COLUMN "created_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "created_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "updated_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE "user_notification_preference" ALTER COLUMN "created_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE "user_notification_preference" ALTER COLUMN "updated_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE "user_notification_workspace_rule" ALTER COLUMN "created_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE "user_notification_workspace_rule" ALTER COLUMN "updated_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE "verification" ALTER COLUMN "created_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE "verification" ALTER COLUMN "updated_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE "workspace_slug_alias" ALTER COLUMN "created_at" SET DEFAULT (now() AT TIME ZONE 'utc');