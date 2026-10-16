import { and, eq } from "drizzle-orm";
import type { DbOrTx } from "#api/members/index";
import { labelNotFound } from "#api/labels/errors";
import { labelTable } from "#api/labels/tables";

/**
 * A label of this workspace; any other label, including another workspace's,
 * is "not found". `lock` keeps the row from being deleted for the rest of the
 * transaction ("share"), or takes it for a write ("update").
 */
export async function findLabel(
  tx: DbOrTx,
  workspaceId: string,
  labelId: string,
  lock?: "share" | "update",
) {
  const query = tx
    .select()
    .from(labelTable)
    .where(
      and(eq(labelTable.id, labelId), eq(labelTable.workspaceId, workspaceId)),
    );
  const [label] = await (lock ? query.for(lock) : query);
  if (!label) throw labelNotFound();
  return label;
}
