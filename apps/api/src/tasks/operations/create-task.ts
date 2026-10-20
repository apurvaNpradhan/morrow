import {
  type FieldValues,
  isClosedCategory,
  type TaskPriority,
  TASK_ID_PATTERN,
} from "@morrow/sync-schemas";
import { eq, sql } from "drizzle-orm";
import { withTxid } from "#api/platform/sync/with-txid";
import {
  assertValidPosition,
  findColumn,
  lockProject,
  projectTable,
} from "#api/projects/index";
import { assertLabelsExist } from "#api/labels/index";
import { rethrowTaskViolation, taskError } from "#api/tasks/errors";
import { checkFieldValues } from "#api/tasks/lib/field-values";
import { freePosition } from "#api/tasks/lib/free-position";
import { assertAssignable, type TaskActor } from "#api/tasks/lib/assignee";
import { saveDescription } from "#api/tasks/lib/description";
import { findParent } from "#api/tasks/lib/find-parent";
import { refreshSubtaskCounts } from "#api/tasks/lib/subtask-counts";
import { recordParentChange } from "#api/tasks/history/record-parent-change";
import { recordTaskEvent } from "#api/tasks/history/record-task-event";
import { recordTaskActivity } from "#api/tasks/lib/record-task-activity";
import { taskTable } from "#api/tasks/tables";

export type NewTask = {
  id: string;
  columnId: string;
  position: string;
  title: string;
  description?: string;
  priority?: TaskPriority;
  assigneeId?: string | null;
  dueDate?: string | null;
  labelIds?: string[];
  parentId?: string | null;
  fieldValues?: FieldValues;
};

/**
 * Creates a task at the position the client chose (or right after whatever
 * holds it, see `freePosition`). The id and position come
 * from the browser so the card can appear before the server answers; the
 * ticket number is the Project's next one, taken under the project lock so two
 * creates never share a number. A task created in a done or canceled Column
 * starts out completed. Field values must name Fields of the Project and
 * their options.
 */
export async function createTask(
  workspaceId: string,
  projectId: string,
  actor: TaskActor,
  input: NewTask,
) {
  if (!TASK_ID_PATTERN.test(input.id)) throw taskError("INVALID_ID");
  assertValidPosition(input.position);
  try {
    const { result, txid } = await withTxid(async (tx) => {
      const project = await lockProject(tx, workspaceId, projectId);
      const column = await findColumn(tx, projectId, input.columnId).catch(
        () => {
          throw taskError("COLUMN_NOT_IN_PROJECT");
        },
      );
      const labelIds = await assertLabelsExist(
        tx,
        workspaceId,
        input.labelIds ?? [],
      );
      const fieldValues = await checkFieldValues(
        tx,
        projectId,
        input.fieldValues ?? {},
      );
      await assertAssignable(
        tx,
        workspaceId,
        actor,
        input.assigneeId ?? null,
        null,
      );

      const parent = input.parentId
        ? await findParent(tx, projectId, input.parentId)
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
          id: input.id,
          projectId,
          parentId: parent?.id ?? null,
          columnId: input.columnId,
          number: counter.number,
          title: input.title,
          priority: input.priority ?? "none",
          assigneeId: input.assigneeId ?? null,
          dueDate: input.dueDate ?? null,
          labelIds,
          fieldValues,
          position: await freePosition(tx, input.columnId, input.position),
          completedAt: isClosedCategory(column.category) ? new Date() : null,
          createdBy: actor.userId,
        })
        .returning({
          id: taskTable.id,
          number: taskTable.number,
          title: taskTable.title,
        });
      if (!task) throw new Error("Task insert returned no row");
      await saveDescription(
        tx,
        { workspaceId, projectId, taskId: task.id, userId: actor.userId },
        input.description ?? "",
      );
      await recordTaskActivity(tx, "task.created", workspaceId, project, task);
      await recordTaskEvent(tx, projectId, task.id, {
        type: "created",
        data: {},
      });
      await refreshSubtaskCounts(tx, [parent?.id]);
      await recordParentChange(tx, project, task, null, parent);
      return task;
    });
    return { id: result.id, number: result.number, txid };
  } catch (error) {
    rethrowTaskViolation(error);
  }
}
