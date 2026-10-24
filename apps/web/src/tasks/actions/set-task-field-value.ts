import type { FieldValue } from "@morrow/sync-schemas";
import { taskCollection } from "../collections/task-collection";
import { updateTask } from "./task-actions";

/**
 * Sets a task's value for a Field, or clears it with `null`. Reads the task as
 * it is now, so a second pick before the first has synced builds on it.
 */
export async function setTaskFieldValue(
  taskId: string,
  fieldId: string,
  value: FieldValue | null,
) {
  const task = taskCollection.get(taskId);
  if (!task) return;
  const { [fieldId]: _cleared, ...others } = task.fieldValues;
  await updateTask(taskId, {
    fieldValues: value === null ? others : { ...others, [fieldId]: value },
  });
}
