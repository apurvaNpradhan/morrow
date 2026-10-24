CREATE TABLE "task_ticket_alias" (
	"project_id" text NOT NULL,
	"number" integer NOT NULL,
	"task_id" text NOT NULL,
	CONSTRAINT "task_ticket_alias_project_id_number_pk" PRIMARY KEY("project_id","number")
);
--> statement-breakpoint
ALTER TABLE "task_ticket_alias" ADD CONSTRAINT "task_ticket_alias_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_ticket_alias" ADD CONSTRAINT "task_ticket_alias_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_ticket_alias_taskId_idx" ON "task_ticket_alias" USING btree ("task_id");