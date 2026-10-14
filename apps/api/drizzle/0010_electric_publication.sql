-- Electric runs with manual table publishing (ELECTRIC_MANUAL_TABLE_PUBLISHING),
-- so it reads only the tables listed in this publication. The publication
-- starts empty; each migration that syncs a table adds it (see 0011). The
-- `electric` role (created by hand, see docs/runbook.md) needs to reach the
-- schema before it can read any table in it.
CREATE PUBLICATION electric_publication_default;--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO electric;
