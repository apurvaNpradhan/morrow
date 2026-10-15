import {
  isClosedCategory,
  TASK_ID_PATTERN,
  TASK_TITLE_MAX,
} from "@morrow/sync-schemas";
import { eq, sql } from "drizzle-orm";
import { withTxid } from "#api/platform/sync/with-txid";
import {
  assertValidPosition,
  findColumn,
  lockProject,
  projectTable,
} from "#api/projects/index";
import { rethrowTaskViolation, taskError } from "#api/tasks/errors";
import type { TaskActor } from "#api/tasks/lib/assignee";
import { findTask } from "#api/tasks/lib/find-task";
import { recordTaskActivity } from "#api/tasks/lib/record-task-activity";
import { taskTable } from "#api/tasks/tables";

const COPY_SUFFIX = " (copy)";

/**
 * Copies a task into the same column under a new id, at a position the client
 * chose. The copy keeps the description, priority and due date. It keeps the
 * assignee only when the actor could assign them; otherwise it is unassigned
 * rather than refused.
 */
export async function duplicateTask(
  workspaceId: string,
  projectId: string,
  sourceId: string,
  actor: TaskActor,
  copy: { id: string; position: string },
) {
  if (!TASK_ID_PATTERN.test(copy.id)) throw taskError("INVALID_ID");
  assertValidPosition(copy.position);
  try {
    const { result, txid } = await withTxid(async (tx) => {
      const project = await lockProject(tx, workspaceId, projectId);
      const source = await findTask(tx, projectId, sourceId);
      const column = await findColumn(tx, projectId, source.columnId);
      // The source's assignee is a current Member, so only the assign rule applies.
      const assigneeId =
        actor.canAssign || source.assigneeId === actor.userId
          ? source.assigneeId
          : null;

      const [counter] = await tx
        .update(projectTable)
        .set({ lastTaskNumber: sql`${projectTable.lastTaskNumber} + 1` })
        .where(eq(projectTable.id, projectId))
        .returning({ number: projectTable.lastTaskNumber });
      if (!counter) throw new Error("Project counter returned no row");

      const [task] = await tx
        .insert(taskTable)
        .values({
          id: copy.id,
          projectId,
          columnId: source.columnId,
          number: counter.number,
          title: `${source.title.slice(0, TASK_TITLE_MAX - COPY_SUFFIX.length)}${COPY_SUFFIX}`,
          description: source.description,
          priority: source.priority,
          assigneeId,
          dueDate: source.dueDate,
          position: copy.position,
          completedAt: isClosedCategory(column.category) ? new Date() : null,
          createdBy: actor.userId,
        })
        .returning({
          id: taskTable.id,
          number: taskTable.number,
          title: taskTable.title,
        });
      if (!task) throw new Error("Task insert returned no row");
      await recordTaskActivity(tx, "task.created", workspaceId, project, task);
      return task;
    });
    return { id: result.id, number: result.number, txid };
  } catch (error) {
    rethrowTaskViolation(error);
  }
}
