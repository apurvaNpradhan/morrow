import { randomBytes } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "../../../apps/api/src/platform/database";

/** A well-formed cuid2, as the browser would generate. */
export function newCommentId() {
  return `c${randomBytes(12).toString("hex").slice(0, 23)}`;
}

/** A task's comments straight from the database, oldest first. */
export async function commentRows(taskId: string) {
  return db
    .select()
    .from(schema.taskCommentTable)
    .where(eq(schema.taskCommentTable.taskId, taskId))
    .orderBy(asc(schema.taskCommentTable.createdAt));
}
