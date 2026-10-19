import { taskCollection } from "../collections/task-collection";
import { updateTask } from "./task-actions";

/**
 * Sets a task's value for a Field to an option id, or clears it with `null`.
 * Reads the task as it is now, so a second pick before the first has synced
 * builds on it.
 */
export async function setTaskFieldValue(
  taskId: string,
  fieldId: string,
  optionId: string | null,
) {
  const task = taskCollection.get(taskId);
  if (!task) return;
  const { [fieldId]: _cleared, ...others } = task.fieldValues;
  await updateTask(taskId, {
    fieldValues:
      optionId === null ? others : { ...others, [fieldId]: optionId },
  });
}
