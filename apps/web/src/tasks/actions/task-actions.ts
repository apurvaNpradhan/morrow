import { createId } from "@paralleldrive/cuid2";
import {
  isClosedCategory,
  nextCompletedAt,
  type ProjectColumnRow,
  type TaskPriority,
  type TaskRow,
} from "@morrow/sync-schemas";
import { generateKeyBetween } from "fractional-indexing";
import { rpc } from "@/app/lib/orpc";
import { taskCollection } from "../collections/task-collection";
import { workspaceOf } from "../collections/task-writes";
import { columnTasks } from "../queries/task-queries";

/*
 * The writes components make. Each changes the local collection at once, which
 * shows on screen immediately, and resolves when the change has come back
 * through sync; if the server refuses it the collection rolls back and the
 * promise rejects.
 */

/** A position after every task of the column that is loaded. */
async function endOfColumn(columnId: string) {
  // Loads the column's unarchived tasks when they are not in memory yet (a
  // task created from outside its project); archived tasks the server skips.
  await columnTasks(columnId).preload();
  const last = taskCollection.toArray
    .filter((task) => task.columnId === columnId)
    .reduce<string | null>(
      (max, task) =>
        max === null || task.position > max ? task.position : max,
      null,
    );
  return generateKeyBetween(last, null);
}

export type NewTask = {
  projectId: string;
  column: ProjectColumnRow;
  title: string;
  description?: string;
  priority?: TaskPriority;
  assigneeId?: string | null;
  dueDate?: string | null;
  /** The signed-in user, recorded as the creator. */
  userId: string;
};

/** Creates a task at the end of its column; resolves with it once its ticket number has synced. */
export async function createTask(input: NewTask): Promise<TaskRow> {
  const now = new Date();
  const id = createId();
  const transaction = taskCollection.insert(
    {
      id,
      projectId: input.projectId,
      columnId: input.column.id,
      // The server numbers it; until then the card shows the key and an ellipsis.
      number: 0,
      title: input.title,
      // The server counts them from the description and sends them back.
      checklistDone: 0,
      checklistTotal: 0,
      priority: input.priority ?? "none",
      assigneeId: input.assigneeId ?? null,
      dueDate: input.dueDate ?? null,
      position: await endOfColumn(input.column.id),
      completedAt: isClosedCategory(input.column.category) ? now : null,
      archivedAt: null,
      createdBy: input.userId,
      createdAt: now,
      updatedAt: now,
    },
    { metadata: { description: input.description } },
  );
  await transaction.isPersisted.promise;
  const created = taskCollection.get(id);
  if (!created) throw new Error("The created task did not sync");
  return created;
}

type TaskPatch = Partial<
  Pick<
    TaskRow,
    | "title"
    | "priority"
    | "assigneeId"
    | "dueDate"
    | "columnId"
    | "position"
    | "completedAt"
    | "archivedAt"
  >
>;

/** Edits a task; each changed field group is its own write on the server. */
export async function updateTask(taskId: string, patch: TaskPatch) {
  const transaction = taskCollection.update(taskId, (draft) => {
    Object.assign(draft, patch);
  });
  await transaction.isPersisted.promise;
}

/**
 * Puts a task in a column at a position. Entering or leaving a done or
 * canceled column changes its completion in the same step, so it mutes or
 * revives at once.
 */
export async function moveTask(
  task: TaskRow,
  target: {
    column: ProjectColumnRow;
    from: ProjectColumnRow;
    position: string;
  },
) {
  await updateTask(task.id, {
    columnId: target.column.id,
    position: target.position,
    completedAt: nextCompletedAt(
      task.completedAt,
      target.from.category,
      target.column.category,
      new Date(),
    ),
  });
}

/** Moves a task to the end of another column. */
export async function moveTaskToColumn(
  task: TaskRow,
  column: ProjectColumnRow,
  from: ProjectColumnRow,
) {
  if (column.id === task.columnId) return;
  await moveTask(task, {
    column,
    from,
    position: await endOfColumn(column.id),
  });
}

export async function archiveTask(taskId: string) {
  await updateTask(taskId, { archivedAt: new Date() });
}

export async function unarchiveTask(taskId: string) {
  await updateTask(taskId, { archivedAt: null });
}

export async function deleteTask(taskId: string) {
  await taskCollection.delete(taskId).isPersisted.promise;
}

/** Copies a task into its own column, after the last task; resolves with the copy. */
export async function duplicateTask(task: TaskRow, userId: string) {
  const now = new Date();
  const id = createId();
  const transaction = taskCollection.insert(
    {
      ...task,
      id,
      number: 0,
      title: `${task.title} (copy)`,
      position: await endOfColumn(task.columnId),
      archivedAt: null,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    },
    { metadata: { duplicateOf: task.id } },
  );
  await transaction.isPersisted.promise;
  return taskCollection.get(id);
}

/** Archives every unarchived task of a done or canceled column in one call. */
export async function archiveCompleted(
  projectId: string,
  columnId: string,
): Promise<number> {
  const { count, txid } = await rpc.tasks.archiveCompleted({
    workspaceId: workspaceOf(projectId),
    projectId,
    columnId,
  });
  if (txid !== null) await taskCollection.utils.awaitTxId(txid);
  return count;
}
