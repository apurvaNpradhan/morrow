DROP INDEX "asset_draft_expiry_idx";--> statement-breakpoint
ALTER TABLE "asset" ALTER COLUMN "kind" SET DEFAULT 'file';--> statement-breakpoint
ALTER TABLE "asset" ADD COLUMN "task_id" text;--> statement-breakpoint
ALTER TABLE "asset" ADD COLUMN "source_asset_id" text;--> statement-breakpoint
ALTER TABLE "asset" ADD COLUMN "width" integer;--> statement-breakpoint
ALTER TABLE "asset" ADD COLUMN "height" integer;--> statement-breakpoint
ALTER TABLE "asset" ADD COLUMN "attached_at" timestamp;--> statement-breakpoint
ALTER TABLE "asset" ADD CONSTRAINT "asset_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "asset_taskId_idx" ON "asset" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "asset_taskId_source_idx" ON "asset" USING btree ("task_id","source_asset_id");--> statement-breakpoint
CREATE INDEX "asset_draft_expiry_idx" ON "asset" USING btree ("created_at","id") WHERE "asset"."attached_at" is null;--> statement-breakpoint
ALTER TABLE "asset" DROP COLUMN "surface";--> statement-breakpoint
ALTER TABLE "asset" ADD CONSTRAINT "asset_attached_has_container" CHECK ("asset"."attached_at" is null or "asset"."task_id" is not null);
