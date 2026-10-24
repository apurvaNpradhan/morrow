import { sql } from "drizzle-orm";
import { withTxid } from "#api/platform/sync/with-txid";
import { optionNotFound } from "#api/projects/errors";
import { lockProject } from "#api/projects/lib/lock-project";
import { taskTable } from "#api/tasks/index";
import { findChoiceField } from "../lib/find-field";
import { writeOptions } from "../lib/write-options";

/**
 * Deletes an option and clears it from every Task of the Project that holds it
 * (a multi choice keeps its other options), in the same transaction. A system cascade: no task history.
 */
export async function deleteOption(
  workspaceId: string,
  projectId: string,
  fieldId: string,
  optionId: string,
) {
  const { txid } = await withTxid(async (tx) => {
    await lockProject(tx, workspaceId, projectId);
    const field = await findChoiceField(tx, projectId, fieldId, "update");
    if (!field.options.some((o) => o.id === optionId)) throw optionNotFound();
    if (field.type === "multi_choice") {
      // Take the id out of each array, then drop the key where nothing is left.
      await tx
        .update(taskTable)
        .set({
          fieldValues: sql`jsonb_set(${taskTable.fieldValues}, ARRAY[${fieldId}]::text[], (
            SELECT coalesce(jsonb_agg(e), '[]'::jsonb)
            FROM jsonb_array_elements(${taskTable.fieldValues} -> ${fieldId}::text) AS e
            WHERE e <> to_jsonb(${optionId}::text)))`,
        })
        .where(
          sql`${taskTable.projectId} = ${projectId} AND (${taskTable.fieldValues} -> ${fieldId}::text) @> to_jsonb(${optionId}::text)`,
        );
      await tx
        .update(taskTable)
        .set({ fieldValues: sql`${taskTable.fieldValues} - ${fieldId}::text` })
        .where(
          sql`${taskTable.projectId} = ${projectId} AND (${taskTable.fieldValues} -> ${fieldId}::text) = '[]'::jsonb`,
        );
    } else {
      await tx
        .update(taskTable)
        .set({ fieldValues: sql`${taskTable.fieldValues} - ${fieldId}::text` })
        .where(
          sql`${taskTable.projectId} = ${projectId} AND ${taskTable.fieldValues} ->> ${fieldId} = ${optionId}`,
        );
    }
    await writeOptions(
      tx,
      fieldId,
      field.options.filter((o) => o.id !== optionId),
    );
  });
  return { txid };
}
