import { sql } from "drizzle-orm";
import { withTxid } from "#api/platform/sync/with-txid";
import { optionNotFound } from "#api/projects/errors";
import { lockProject } from "#api/projects/lib/lock-project";
import { taskTable } from "#api/tasks/index";
import { findField } from "../lib/find-field";
import { writeOptions } from "../lib/write-options";

/**
 * Deletes an option and clears it from every Task of the Project that holds it,
 * in the same transaction. A system cascade: no task history.
 */
export async function deleteOption(
  workspaceId: string,
  projectId: string,
  fieldId: string,
  optionId: string,
) {
  const { txid } = await withTxid(async (tx) => {
    await lockProject(tx, workspaceId, projectId);
    const field = await findField(tx, projectId, fieldId, "update");
    if (!field.options.some((o) => o.id === optionId)) throw optionNotFound();
    await tx
      .update(taskTable)
      .set({ fieldValues: sql`${taskTable.fieldValues} - ${fieldId}::text` })
      .where(
        sql`${taskTable.projectId} = ${projectId} AND ${taskTable.fieldValues} ->> ${fieldId} = ${optionId}`,
      );
    await writeOptions(
      tx,
      fieldId,
      field.options.filter((o) => o.id !== optionId),
    );
  });
  return { txid };
}
