import {
  type FieldValue,
  isChoiceType,
  optionsHeld,
} from "@morrow/sync-schemas";
import { eq, sql } from "drizzle-orm";
import { withTxid } from "#api/platform/sync/with-txid";
import { findField, lockProject } from "#api/projects/index";
import { recordTaskEvent } from "#api/tasks/history/record-task-event";
import { checkFieldValue } from "#api/tasks/lib/field-values";
import { findTask } from "#api/tasks/lib/find-task";
import { taskTable } from "#api/tasks/tables";

type FieldRow = Awaited<ReturnType<typeof findField>>;

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
            : sql`jsonb_set(${taskTable.fieldValues}, ARRAY[${fieldId}]::text[], ${JSON.stringify(next)}::jsonb)`,
      })
      .where(eq(taskTable.id, taskId));
    const was = task.fieldValues[fieldId] ?? null;
    if (JSON.stringify(was) !== JSON.stringify(next)) {
      await recordTaskEvent(tx, projectId, taskId, {
        type: "field_changed",
        data: {
          field: { id: field.id, name: field.name },
          from: snapshot(field, was),
          to: snapshot(field, next),
        },
      });
    }
  });
  return { txid };
}

/** What a Field held, with option names and colours as they are now, for the history. */
function snapshot(field: FieldRow, value: FieldValue | null) {
  if (value === null) return null;
  if (!isChoiceType(field.type))
    return { value: value as string | number | true };
  const held = optionsHeld(field, value).map(({ id, name, color }) => ({
    id,
    name,
    color,
  }));
  if (field.type === "multi_choice") return { options: held };
  return held[0] ?? null;
}
