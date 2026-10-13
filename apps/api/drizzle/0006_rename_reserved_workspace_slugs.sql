-- Workspace URLs moved from /w/<slug> to /<slug>, so the words the app uses
-- for its own top-level routes and API paths can no longer be slugs
-- (RESERVED_WORKSPACE_SLUGS in @morrow/permissions). A workspace that already
-- holds one would be unreachable: give it a unique suffix, and drop any former
-- slug that is now reserved.
UPDATE "workspace"
SET "slug" = "slug" || '-' || substr("id", 1, 6)
WHERE "slug" IN ('new', 'settings', 'admin', 'auth', 'invitation', 'mcp', 'onboarding', 'privacy', 'test-error', 'api', 'rpc', 'assets', 'images');--> statement-breakpoint
DELETE FROM "workspace_slug_alias"
WHERE "slug" IN ('new', 'settings', 'admin', 'auth', 'invitation', 'mcp', 'onboarding', 'privacy', 'test-error', 'api', 'rpc', 'assets', 'images');
