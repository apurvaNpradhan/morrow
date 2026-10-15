import { type ColumnCategory, isClosedCategory } from "@morrow/sync-schemas";
import { eq, sql } from "drizzle-orm";
import { withTxid } from "#api/platform/sync/with-txid";
import { rethrowViolation } from "#api/projects/errors";
import { assertValidPosition } from "#api/projects/lib/position";
import { lockProject } from "#api/projects/lib/lock-project";
import { projectColumnTable } from "#api/projects/tables";
import { taskTable } from "#api/tasks/index";
import { findColumn } from "../lib/find-column";
import { assertNotLastRequiredColumn } from "../lib/required-columns";

/**
 * Puts a column at a position the client computed among the columns of the
 * target category. Moving it into another category changes its category too,
 * which is refused if it is the last `unstarted` or `done` column, and brings
 * the completion of the column's tasks in line with the new category.
 */
export async function moveColumn(
  workspaceId: string,
  projectId: string,
  columnId: string,
  target: { category: ColumnCategory; position: string },
) {
  assertValidPosition(target.position);
  try {
    const { txid } = await withTxid(async (tx) => {
      await lockProject(tx, workspaceId, projectId);
      const column = await findColumn(tx, projectId, columnId);
      if (column.category !== target.category) {
        await assertNotLastRequiredColumn(tx, projectId, column);
      }
      await tx
        .update(projectColumnTable)
        .set({ category: target.category, position: target.position })
        .where(eq(projectColumnTable.id, columnId));
      if (column.category !== target.category) {
        await tx
          .update(taskTable)
          .set({
            completedAt: isClosedCategory(target.category)
              ? sql`coalesce(${taskTable.completedAt}, now() AT TIME ZONE 'utc')`
              : null,
          })
          .where(eq(taskTable.columnId, columnId));
      }
    });
    return { txid };
  } catch (error) {
    rethrowViolation(error, { project_column_position_uidx: "POSITION_TAKEN" });
  }
}
