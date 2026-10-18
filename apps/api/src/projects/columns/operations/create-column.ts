import {
  type ColumnCategory,
  DEFAULT_COLUMN_COLOR,
} from "@morrow/sync-schemas";
import { and, eq, max } from "drizzle-orm";
import { generateKeyBetween } from "fractional-indexing";
import { withTxid } from "#api/platform/sync/with-txid";
import { rethrowViolation } from "#api/projects/errors";
import { lockProject } from "#api/projects/lib/lock-project";
import { projectColumnTable } from "#api/projects/tables";

type NewColumn = {
  name: string;
  category: ColumnCategory;
  color?: string;
};

/** Adds a column at the end of its category. */
export async function createColumn(
  workspaceId: string,
  projectId: string,
  input: NewColumn,
) {
  try {
    const { result: id, txid } = await withTxid(async (tx) => {
      await lockProject(tx, workspaceId, projectId);
      const [last] = await tx
        .select({ position: max(projectColumnTable.position) })
        .from(projectColumnTable)
        .where(
          and(
            eq(projectColumnTable.projectId, projectId),
            eq(projectColumnTable.category, input.category),
          ),
        );
      const [column] = await tx
        .insert(projectColumnTable)
        .values({
          projectId,
          name: input.name,
          category: input.category,
          color: input.color ?? DEFAULT_COLUMN_COLOR[input.category],
          position: generateKeyBetween(last?.position ?? null, null),
        })
        .returning({ id: projectColumnTable.id });
      if (!column) throw new Error("Column insert returned no row");
      return column.id;
    });
    return { id, txid };
  } catch (error) {
    rethrowViolation(error, {
      project_column_project_name_uidx: "COLUMN_NAME_TAKEN",
    });
  }
}
