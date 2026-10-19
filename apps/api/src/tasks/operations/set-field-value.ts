import { eq, sql } from "drizzle-orm";
import { withTxid } from "#api/platform/sync/with-txid";
import { findField, lockProject } from "#api/projects/index";
import { recordTaskEvent } from "#api/tasks/history/record-task-event";
import { checkFieldValue } from "#api/tasks/lib/field-values";
import { findTask } from "#api/tasks/lib/find-task";
import { taskTable } from "#api/tasks/tables";

/**
 * Sets a Task's value for a Field, or clears it with `null`. Touches only that
 * key (`jsonb_set`, or `-`), under the Project lock, so two people setting
 * different Fields of one Task both land. The Field row is share-locked first
 * and the value checked against its options, so a Field delete in flight
 * either strips the value afterwards or makes this write fail. `updatedAt`
 * always changes, so the write reaches sync even when nothing did.
 */
export async function setFieldValue(
  workspaceId: string,
  projectId: string,
  taskId: string,
  fieldId: string,
  value: unknown,
) {
  const { txid } = await withTxid(async (tx) => {
    await lockProject(tx, workspaceId, projectId);
    const task = await findTask(tx, projectId, taskId);
    const field = await findField(tx, projectId, fieldId, "share");
    const next = value === null ? null : checkFieldValue(field, value);
    await tx
      .update(taskTable)
      .set({
        fieldValues:
          next === null
            ? sql`${taskTable.fieldValues} - ${fieldId}::text`
            : sql`jsonb_set(${taskTable.fieldValues}, ARRAY[${fieldId}]::text[], to_jsonb(${next}::text))`,
      })
      .where(eq(taskTable.id, taskId));
    const was = task.fieldValues[fieldId] ?? null;
    if (was !== next) {
      const ref = (id: string | null) => {
        const option = field.options.find((candidate) => candidate.id === id);
        return option
          ? { id: option.id, name: option.name, color: option.color }
          : null;
      };
      await recordTaskEvent(tx, projectId, taskId, {
        type: "field_changed",
        data: {
          field: { id: field.id, name: field.name },
          from: ref(was),
          to: ref(next),
        },
      });
    }
  });
  return { txid };
}
