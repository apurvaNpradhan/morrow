import { eq } from "drizzle-orm";
import { withTxid } from "#api/platform/sync/with-txid";
import { rethrowViolation } from "#api/projects/errors";
import { lockProject } from "#api/projects/lib/lock-project";
import { projectFieldTable } from "#api/projects/tables";
import { findField } from "../lib/find-field";

/** Renames a Field. Tasks hold the Field's id, so none of them is written. */
export async function updateField(
  workspaceId: string,
  projectId: string,
  fieldId: string,
  changes: { name: string },
) {
  try {
    const { txid } = await withTxid(async (tx) => {
      await lockProject(tx, workspaceId, projectId);
      await findField(tx, projectId, fieldId);
      await tx
        .update(projectFieldTable)
        .set({ name: changes.name })
        .where(eq(projectFieldTable.id, fieldId));
    });
    return { txid };
  } catch (error) {
    rethrowViolation(error, {
      project_field_project_name_uidx: "FIELD_NAME_TAKEN",
    });
  }
}
