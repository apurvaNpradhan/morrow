-- Colours are stored as #rrggbb only. Palette names are converted here, in the
-- rows and in the label payloads of task history.
ALTER TABLE "label" DROP CONSTRAINT IF EXISTS "label_color_check";--> statement-breakpoint
ALTER TABLE "project" DROP CONSTRAINT IF EXISTS "project_color_check";--> statement-breakpoint
ALTER TABLE "project_column" DROP CONSTRAINT IF EXISTS "project_column_color_check";--> statement-breakpoint
CREATE TEMP TABLE "color_hex" ("name" text PRIMARY KEY, "hex" text NOT NULL);--> statement-breakpoint
INSERT INTO "color_hex" ("name", "hex") VALUES ('gray', '#a1a1aa'), ('slate', '#64748b'), ('red', '#ef4444'), ('orange', '#f97316'), ('amber', '#f59e0b'), ('green', '#22c55e'), ('teal', '#14b8a6'), ('blue', '#3b82f6'), ('violet', '#8b5cf6'), ('pink', '#ec4899');--> statement-breakpoint
UPDATE "label" SET "color" = "color_hex"."hex" FROM "color_hex" WHERE "label"."color" = "color_hex"."name";--> statement-breakpoint
UPDATE "project" SET "color" = "color_hex"."hex" FROM "color_hex" WHERE "project"."color" = "color_hex"."name";--> statement-breakpoint
UPDATE "project_column" SET "color" = "color_hex"."hex" FROM "color_hex" WHERE "project_column"."color" = "color_hex"."name";--> statement-breakpoint
UPDATE "task_event" SET "data" = jsonb_set("data", '{added}', (
  SELECT coalesce(jsonb_agg(jsonb_set(e.elem, '{color}', to_jsonb(coalesce(map."hex", e.elem->>'color'))) ORDER BY e.n), '[]'::jsonb)
  FROM jsonb_array_elements("task_event"."data"->'added') WITH ORDINALITY AS e(elem, n)
  LEFT JOIN "color_hex" AS map ON map."name" = e.elem->>'color'
)) WHERE "type" = 'labels';--> statement-breakpoint
UPDATE "task_event" SET "data" = jsonb_set("data", '{removed}', (
  SELECT coalesce(jsonb_agg(jsonb_set(e.elem, '{color}', to_jsonb(coalesce(map."hex", e.elem->>'color'))) ORDER BY e.n), '[]'::jsonb)
  FROM jsonb_array_elements("task_event"."data"->'removed') WITH ORDINALITY AS e(elem, n)
  LEFT JOIN "color_hex" AS map ON map."name" = e.elem->>'color'
)) WHERE "type" = 'labels';--> statement-breakpoint
DROP TABLE "color_hex";--> statement-breakpoint
ALTER TABLE "label" ADD CONSTRAINT "label_color_check" CHECK ("label"."color" ~ '^#[0-9a-f]{6}$');--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_color_check" CHECK ("project"."color" ~ '^#[0-9a-f]{6}$');--> statement-breakpoint
ALTER TABLE "project_column" ADD CONSTRAINT "project_column_color_check" CHECK ("project_column"."color" ~ '^#[0-9a-f]{6}$');