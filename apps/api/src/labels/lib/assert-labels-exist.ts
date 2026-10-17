import { and, eq, inArray } from "drizzle-orm";
import type { DbOrTx } from "#api/members/index";
import { labelNotFound } from "#api/labels/errors";
import { labelTable } from "#api/labels/tables";

/**
 * The distinct ids, after checking that every one is a label of this
 * workspace; any other is "not found". Takes a share lock on them, as applying
 * one label does, so a delete cannot strip them before the task is written.
 */
export async function assertLabelsExist(
  tx: DbOrTx,
  workspaceId: string,
  labelIds: readonly string[],
) {
  const unique = [...new Set(labelIds)];
  if (unique.length === 0) return unique;
  const found = await tx
    .select({ id: labelTable.id })
    .from(labelTable)
    .where(
      and(
        eq(labelTable.workspaceId, workspaceId),
        inArray(labelTable.id, unique),
      ),
    )
    .for("share");
  if (found.length !== unique.length) throw labelNotFound();
  return unique;
}
