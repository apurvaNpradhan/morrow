CREATE TABLE "workspace_slug_alias" (
	"slug" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "onboarding_completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "workspace_slug_alias" ADD CONSTRAINT "workspace_slug_alias_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workspace_slug_alias_workspaceId_idx" ON "workspace_slug_alias" USING btree ("workspace_id");