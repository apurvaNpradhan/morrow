import { type TaskEvent, taskEventSchema } from "@morrow/sync-schemas";
import { desc, eq } from "drizzle-orm";
import type { DbOrTx } from "#api/members/index";
import { eventContext } from "#api/platform/event-context";
import { taskEventTable } from "#api/tasks/tables";
import { foldTaskEvent, type LatestTaskEvent } from "./fold-task-event";

/**
 * Writes one entry of a task's history, by the request's verified actor, in
 * the caller's transaction, after the change it describes and while the
 * Project lock is held. The same person's repeated change folds into their
 * last entry (see `foldTaskEvent`). Only user-made changes to one task call
 * this: reorders and system cascades do not.
 */
export async function recordTaskEvent(
  tx: DbOrTx,
  projectId: string,
  taskId: string,
  event: TaskEvent,
) {
  const actorId = eventContext.getStore()?.actorUserId ?? null;
  const now = new Date();

  const [row] = await tx
    .select()
    .from(taskEventTable)
    .where(eq(taskEventTable.taskId, taskId))
    .orderBy(desc(taskEventTable.createdAt), desc(taskEventTable.id))
    .limit(1);
  const parsed = row
    ? taskEventSchema.safeParse({ type: row.type, data: row.data })
    : null;
  const latest: LatestTaskEvent | null =
    row && parsed?.success
      ? { actorId: row.actorId, event: parsed.data, updatedAt: row.updatedAt }
      : null;

  const decision = foldTaskEvent(latest, { actorId, event }, now);
  if (decision.kind === "delete" && row) {
    await tx.delete(taskEventTable).where(eq(taskEventTable.id, row.id));
  } else if (decision.kind === "merge" && row) {
    await tx
      .update(taskEventTable)
      .set({ data: decision.data, updatedAt: now })
      .where(eq(taskEventTable.id, row.id));
  } else {
    await tx.insert(taskEventTable).values({
      taskId,
      projectId,
      actorId,
      type: event.type,
      data: event.data,
      createdAt: now,
      updatedAt: now,
    });
  }
}
