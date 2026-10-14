-- Declares "invitation" and "workspace" as synced tables (see 0011).
ALTER TABLE "invitation" REPLICA IDENTITY FULL;--> statement-breakpoint
ALTER TABLE "workspace" REPLICA IDENTITY FULL;--> statement-breakpoint
ALTER PUBLICATION electric_publication_default ADD TABLE "invitation", "workspace";--> statement-breakpoint
GRANT SELECT ON "invitation", "workspace" TO electric;
