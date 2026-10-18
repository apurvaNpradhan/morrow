-- Workspace search. Words are matched with English full-text search; task
-- titles also with trigrams, for half-typed and misspelled words. The indexes
-- are on expressions, so no column is added and no shape changes.
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX "task_comment_body_fts_idx" ON "task_comment" USING gin (to_tsvector('english', "body"));--> statement-breakpoint
CREATE INDEX "task_description_fts_idx" ON "task_description" USING gin (to_tsvector('english', "description"));--> statement-breakpoint
CREATE INDEX "task_title_fts_idx" ON "task" USING gin (to_tsvector('english', "title"));--> statement-breakpoint
CREATE INDEX "task_title_trgm_idx" ON "task" USING gin ("title" gin_trgm_ops);
