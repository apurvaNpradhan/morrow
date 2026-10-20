ALTER TABLE "asset" REPLICA IDENTITY FULL;--> statement-breakpoint
ALTER PUBLICATION electric_publication_default ADD TABLE "asset";--> statement-breakpoint
GRANT SELECT ON "asset" TO electric;
