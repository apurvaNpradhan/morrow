import { taskCollection } from "../collections/task-collection";
import { updateTask } from "./task-actions";

/**
 * Puts a label on a task, or takes it off when it is already there. Reads the
 * task as it is now, so a second pick before the first has synced builds on it.
 */
export async function toggleTaskLabel(taskId: string, labelId: string) {
  const task = taskCollection.get(taskId);
  if (!task) return;
  await updateTask(taskId, {
    labelIds: task.labelIds.includes(labelId)
      ? task.labelIds.filter((id) => id !== labelId)
      : [...task.labelIds, labelId],
  });
}
