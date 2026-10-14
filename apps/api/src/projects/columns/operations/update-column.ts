import type { ColumnColor } from "@morrow/sync-schemas";
import { eq } from "drizzle-orm";
import { withTxid } from "#api/platform/sync/with-txid";
import { projectError, violatedConstraint } from "#api/projects/errors";
import { lockProject } from "#api/projects/lib/lock-project";
import { projectColumnTable } from "#api/projects/tables";
import { findColumn } from "../lib/find-column";

/** Renames a column or changes its colour. */
export async function updateColumn(
  workspaceId: string,
  projectId: string,
  columnId: string,
  changes: { name?: string; color?: ColumnColor },
) {
  try {
    const { txid } = await withTxid(async (tx) => {
      await lockProject(tx, workspaceId, projectId);
      await findColumn(tx, projectId, columnId);
      await tx
        .update(projectColumnTable)
        .set({
          ...(changes.name !== undefined && { name: changes.name }),
          ...(changes.color !== undefined && { color: changes.color }),
        })
        .where(eq(projectColumnTable.id, columnId));
    });
    return { txid };
  } catch (error) {
    if (violatedConstraint(error) === "project_column_project_name_uidx") {
      throw projectError("COLUMN_NAME_TAKEN");
    }
    throw error;
  }
}
