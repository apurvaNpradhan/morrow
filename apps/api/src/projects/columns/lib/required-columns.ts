import type { ColumnCategory } from "@morrow/sync-schemas";
import { and, count, eq } from "drizzle-orm";
import type { DbOrTx } from "#api/members/index";
import { projectError } from "#api/projects/errors";
import { projectColumnTable } from "#api/projects/tables";

/**
 * Every project keeps one column new items start in (`unstarted`) and one
 * they finish in (`done`); the other categories may be empty.
 */
const REQUIRED_CATEGORIES: ReadonlySet<ColumnCategory> = new Set([
  "unstarted",
  "done",
]);

/**
 * Throws LAST_REQUIRED_COLUMN when the column is the only one of a required
 * category, i.e. when taking it out of that category would leave it empty.
 * The caller holds the project's lock, so the count cannot change under it.
 */
export async function assertNotLastRequiredColumn(
  tx: DbOrTx,
  projectId: string,
  column: { id: string; category: ColumnCategory },
) {
  if (!REQUIRED_CATEGORIES.has(column.category)) return;
  const [row] = await tx
    .select({ total: count() })
    .from(projectColumnTable)
    .where(
      and(
        eq(projectColumnTable.projectId, projectId),
        eq(projectColumnTable.category, column.category),
      ),
    );
  if ((row?.total ?? 0) <= 1) throw projectError("LAST_REQUIRED_COLUMN");
}
