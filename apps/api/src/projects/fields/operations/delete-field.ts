import { eq, sql } from "drizzle-orm";
import { withTxid } from "#api/platform/sync/with-txid";
import { lockProject } from "#api/projects/lib/lock-project";
import { projectFieldTable } from "#api/projects/tables";
import { taskTable } from "#api/tasks/index";
import { findField } from "../lib/find-field";

/**
 * Deletes a Field and removes its key from every Task of the Project in the
 * same transaction. `task.field_values` has no foreign key, so this is the
 * only path that keeps it consistent. A system cascade: no task history.
 */
export async function deleteField(
  workspaceId: string,
  projectId: string,
  fieldId: string,
) {
  const { txid } = await withTxid(async (tx) => {
    await lockProject(tx, workspaceId, projectId);
    await findField(tx, projectId, fieldId, "update");
    await tx
      .update(taskTable)
      .set({ fieldValues: sql`${taskTable.fieldValues} - ${fieldId}::text` })
      .where(
        sql`${taskTable.projectId} = ${projectId} AND ${taskTable.fieldValues} ? ${fieldId}`,
      );
    await tx.delete(projectFieldTable).where(eq(projectFieldTable.id, fieldId));
  });
  return { txid };
}
