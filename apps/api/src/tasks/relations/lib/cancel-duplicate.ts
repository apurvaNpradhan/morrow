import { isClosedCategory, nextCompletedAt } from "@morrow/sync-schemas";
import { and, asc, desc, eq } from "drizzle-orm";
import { generateKeyBetween } from "fractional-indexing";
import type { DbOrTx } from "#api/members/index";
import { findColumn, projectColumnTable } from "#api/projects/index";
import { recordTaskEvent } from "#api/tasks/history/record-task-event";
import { findTask } from "#api/tasks/lib/find-task";
import { refreshBlockedCounts } from "#api/tasks/lib/open-blocker-counts";
import { recordTaskActivity } from "#api/tasks/lib/record-task-activity";
import { refreshSubtaskCounts } from "#api/tasks/lib/subtask-counts";
import { endRecurrence } from "#api/tasks/operations/spawn-next-occurrence";
import { taskTable } from "#api/tasks/tables";

/**
 * Moves a task marked as a duplicate to the end of the first canceled Column
 * of its Project (by position), as moving it there by hand would. A task that
 * is already in a canceled Column, or a Project without one, is left alone.
 * The caller holds the Project's lock.
 */
export async function cancelDuplicate(
  tx: DbOrTx,
  workspaceId: string,
  project: { id: string; key: string },
  taskId: string,
) {
  const task = await findTask(tx, project.id, taskId);
  const from = await findColumn(tx, project.id, task.columnId);
  if (from.category === "canceled") return;
  const [to] = await tx
    .select()
    .from(projectColumnTable)
    .where(
      and(
        eq(projectColumnTable.projectId, project.id),
        eq(projectColumnTable.category, "canceled"),
      ),
    )
    .orderBy(asc(projectColumnTable.position))
    .limit(1);
  if (!to) return;
  // After every position the Column holds, archived tasks included.
  const [last] = await tx
    .select({ position: taskTable.position })
    .from(taskTable)
    .where(eq(taskTable.columnId, to.id))
    .orderBy(desc(taskTable.position))
    .limit(1);
  await tx
    .update(taskTable)
    .set({
      columnId: to.id,
      position: generateKeyBetween(last?.position ?? null, null),
      completedAt: nextCompletedAt(
        task.completedAt,
        from.category,
        to.category,
        new Date(),
      ),
    })
    .where(eq(taskTable.id, task.id));
  if (isClosedCategory(from.category) !== isClosedCategory(to.category)) {
    await refreshSubtaskCounts(tx, [task.parentId]);
    await refreshBlockedCounts(tx, [task.id]);
  }
  const ref = ({ id, name, category }: typeof to) => ({ id, name, category });
  await recordTaskEvent(tx, project.id, task.id, {
    type: "column",
    data: { from: ref(from), to: ref(to) },
  });
  await recordTaskActivity(tx, "task.canceled", workspaceId, project, task);
  // A canceled task ends its series.
  await endRecurrence(tx, project.id, task.id);
}
