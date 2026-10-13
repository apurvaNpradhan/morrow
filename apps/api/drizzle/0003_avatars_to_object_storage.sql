-- Avatars move from bytea rows to object storage. The stored pictures are
-- dropped rather than copied; `user.image` keeps only our own storage URLs, so
-- the old in-database paths are cleared.
UPDATE "user" SET "image" = NULL WHERE "image" LIKE '/api/user/avatar/%';--> statement-breakpoint
DROP TABLE "user_avatar" CASCADE;
