import { and, eq } from "drizzle-orm";
import type { DbOrTx } from "#api/members/index";
import { columnNotFound } from "#api/projects/errors";
import { projectColumnTable } from "#api/projects/tables";

/** A column of this project; any other column, including another project's, is "not found". */
export async function findColumn(
  tx: DbOrTx,
  projectId: string,
  columnId: string,
) {
  const [column] = await tx
    .select()
    .from(projectColumnTable)
    .where(
      and(
        eq(projectColumnTable.id, columnId),
        eq(projectColumnTable.projectId, projectId),
      ),
    );
  if (!column) throw columnNotFound();
  return column;
}
