import { randomBytes } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "../../../apps/api/src/platform/database";

/** A well-formed cuid2, as the browser would generate. */
export function newLinkId() {
  return `k${randomBytes(12).toString("hex").slice(0, 23)}`;
}

/** A task's links straight from the database, oldest first. */
export async function linkRows(taskId: string) {
  return db
    .select()
    .from(schema.taskLinkTable)
    .where(eq(schema.taskLinkTable.taskId, taskId))
    .orderBy(asc(schema.taskLinkTable.createdAt));
}
