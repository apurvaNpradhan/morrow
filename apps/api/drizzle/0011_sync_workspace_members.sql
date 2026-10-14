-- Declares workspace_member and "user" as synced tables: Electric streams their
-- rows to the browser through Morrow's shape proxy. A synced table needs the
-- full row in the WAL (REPLICA IDENTITY FULL), membership in the publication
-- and read access for the `electric` role (created by hand, see docs/runbook.md).
ALTER TABLE "workspace_member" REPLICA IDENTITY FULL;--> statement-breakpoint
ALTER TABLE "user" REPLICA IDENTITY FULL;--> statement-breakpoint
ALTER PUBLICATION electric_publication_default ADD TABLE "workspace_member", "user";--> statement-breakpoint
GRANT SELECT ON "workspace_member", "user" TO electric;
