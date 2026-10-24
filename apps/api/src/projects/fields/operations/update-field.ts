import { type FieldConfig, parseFieldConfig } from "@morrow/sync-schemas";
import { eq } from "drizzle-orm";
import { withTxid } from "#api/platform/sync/with-txid";
import { projectError, rethrowViolation } from "#api/projects/errors";
import { lockProject } from "#api/projects/lib/lock-project";
import { projectFieldTable } from "#api/projects/tables";
import { findField } from "../lib/find-field";

/**
 * Renames a Field and/or replaces its config. Tasks hold the Field's id, so
 * none of them is written; a new bound only applies to values written after it.
 */
export async function updateField(
  workspaceId: string,
  projectId: string,
  fieldId: string,
  changes: { name?: string; config?: FieldConfig },
) {
  try {
    const { txid } = await withTxid(async (tx) => {
      await lockProject(tx, workspaceId, projectId);
      const field = await findField(tx, projectId, fieldId);
      const config =
        changes.config === undefined
          ? undefined
          : parseFieldConfig(field.type, changes.config);
      if (changes.config !== undefined && !config) {
        throw projectError("INVALID_FIELD_CONFIG");
      }
      await tx
        .update(projectFieldTable)
        .set({ name: changes.name, config })
        .where(eq(projectFieldTable.id, fieldId));
    });
    return { txid };
  } catch (error) {
    rethrowViolation(error, {
      project_field_project_name_uidx: "FIELD_NAME_TAKEN",
    });
  }
}
