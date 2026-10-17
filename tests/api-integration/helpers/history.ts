import { asc, eq, sql } from "drizzle-orm";
import { db, schema } from "../../../apps/api/src/platform/database";

/** A task's history straight from the database, oldest first. */
export async function eventsOf(taskId: string) {
  const rows = await db
    .select()
    .from(schema.taskEventTable)
    .where(eq(schema.taskEventTable.taskId, taskId))
    .orderBy(
      asc(schema.taskEventTable.createdAt),
      asc(schema.taskEventTable.updatedAt),
    );
  return rows;
}

/** Just what an event says: its type and payload. */
export async function storyOf(taskId: string) {
  return (await eventsOf(taskId)).map(({ type, data }) => ({ type, data }));
}

/** Makes every event of the task look as if it was last written `minutes` ago. */
export async function ageEvents(taskId: string, minutes: number) {
  await db.execute(
    sql`UPDATE task_event SET updated_at = updated_at - make_interval(mins => ${minutes}) WHERE task_id = ${taskId}`,
  );
}
