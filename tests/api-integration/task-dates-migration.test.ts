import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { db, schema } from "../../apps/api/src/platform/database";
import { resetTestDatabase } from "./helpers/database";
import { storyOf } from "./helpers/history";
import { setupTasks } from "./helpers/tasks";

beforeEach(resetTestDatabase);

const migration = readFileSync(
  resolve(
    __dirname,
    "../../apps/api/drizzle/0034_task_dates_and_time_zone.sql",
  ),
  "utf8",
);

/** The shape the tables had before the migration, to run it against. */
const BEFORE = [
  `ALTER TABLE task ADD COLUMN due_date date`,
  `UPDATE task SET due_date = due_at::date`,
  `ALTER TABLE task DROP CONSTRAINT task_due_has_time_check`,
  `ALTER TABLE task DROP COLUMN due_at`,
  `ALTER TABLE task DROP COLUMN due_has_time`,
  `ALTER TABLE "user" DROP COLUMN time_zone`,
];

describe("migration: task dates and time zone", () => {
  it("turns every existing due date into a day and leaves history readable", async () => {
    const { addTask, projectId } = await setupTasks();
    const dated = await addTask("To Do", { dueDate: "2026-03-08" });
    const undated = await addTask("To Do");
    // An old payload is a bare day, which is how a day is written now.
    await db.insert(schema.taskEventTable).values({
      taskId: dated.id,
      projectId,
      type: "due_date",
      data: { from: "2026-03-01", to: "2026-03-08" },
    });

    await db
      .transaction(async (tx) => {
        for (const statement of BEFORE) await tx.execute(sql.raw(statement));
        for (const statement of migration.split("--> statement-breakpoint")) {
          await tx.execute(sql.raw(statement));
        }
        const rows = await tx.execute<{
          id: string;
          due: string | null;
          timed: boolean;
        }>(
          sql`SELECT id, due_at::text AS due, due_has_time AS timed FROM task ORDER BY number`,
        );
        expect(rows.rows).toEqual([
          { id: dated.id, due: "2026-03-08 00:00:00", timed: false },
          { id: undated.id, due: null, timed: false },
        ]);
        const columns = await tx.execute<{ column_name: string }>(
          sql`SELECT column_name FROM information_schema.columns
              WHERE table_name = 'task' AND column_name = 'due_date'`,
        );
        expect(columns.rows).toEqual([]);
        throw new Error("rollback");
      })
      .catch((error: Error) => {
        if (error.message !== "rollback") throw error;
      });

    expect((await storyOf(dated.id)).at(-1)).toEqual({
      type: "due_date",
      data: { from: "2026-03-01", to: "2026-03-08" },
    });
  });
});
