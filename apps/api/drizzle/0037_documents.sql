-- Documents (pages). `position` is a fractional-index key (COLLATE "C", as in
-- 0014). `documents` is synced (see 0011); the body, the client ids and the
-- checkpoints are not.
CREATE TABLE "document_body" (
	"doc_id" text PRIMARY KEY NOT NULL,
	"content" jsonb NOT NULL,
	"state_vector" "bytea" NOT NULL,
	"schema_version" integer NOT NULL,
	"markdown" text DEFAULT '' NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"size_bytes" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_clients" (
	"doc_id" text NOT NULL,
	"yjs_client_id" bigint NOT NULL,
	"user_id" text NOT NULL,
	"via" text NOT NULL,
	"run_id" text,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "document_clients_doc_id_yjs_client_id_pk" PRIMARY KEY("doc_id","yjs_client_id"),
	CONSTRAINT "document_clients_yjs_client_id_check" CHECK ("document_clients"."yjs_client_id" BETWEEN 0 AND 4294967295)
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"project_id" text,
	"parent_id" text,
	"position" text COLLATE "C" NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"icon" text,
	"generation" integer DEFAULT 1 NOT NULL,
	"over_limit" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp,
	"archived_root_id" text,
	"created_by" text,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "documents_archived_root_check" CHECK (("documents"."archived_at" IS NULL) = ("documents"."archived_root_id" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "document_body" ADD CONSTRAINT "document_body_doc_id_documents_id_fk" FOREIGN KEY ("doc_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_clients" ADD CONSTRAINT "document_clients_doc_id_documents_id_fk" FOREIGN KEY ("doc_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_parent_id_documents_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "documents_workspaceId_idx" ON "documents" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "documents_projectId_idx" ON "documents" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "documents_parentId_idx" ON "documents" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "documents_archivedRootId_idx" ON "documents" USING btree ("archived_root_id");
--> statement-breakpoint
ALTER TABLE "documents" REPLICA IDENTITY FULL;--> statement-breakpoint
ALTER PUBLICATION electric_publication_default ADD TABLE "documents";--> statement-breakpoint
GRANT SELECT ON "documents" TO electric;--> statement-breakpoint
-- Roles are stored per workspace, so the new `document` permission is added to
-- the default "viewer" (none), "member" (create, update) and "admin" (create,
-- update, delete) rows that already exist; new workspaces are seeded with it. A
-- row that already has a `document` entry, a custom role, or a row that is not
-- a JSON object is left as it is.
DO $$
DECLARE
  role_row RECORD;
  parsed jsonb;
  grants jsonb;
BEGIN
  FOR role_row IN
    SELECT id, role, permission FROM "workspace_role" WHERE role IN ('viewer', 'member', 'admin')
  LOOP
    BEGIN
      parsed := role_row.permission::jsonb;
    EXCEPTION WHEN others THEN
      CONTINUE;
    END;
    IF jsonb_typeof(parsed) <> 'object' OR parsed ? 'document' THEN
      CONTINUE;
    END IF;
    grants := CASE role_row.role
      WHEN 'admin' THEN '["create", "update", "delete"]'::jsonb
      WHEN 'member' THEN '["create", "update"]'::jsonb
      ELSE '[]'::jsonb
    END;
    UPDATE "workspace_role"
    SET "permission" = jsonb_set(parsed, '{document}', grants)::text
    WHERE id = role_row.id;
  END LOOP;
END
$$;
