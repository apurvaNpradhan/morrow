import { eq } from "drizzle-orm";
import { withTxid } from "#api/platform/sync/with-txid";
import { rethrowLabelViolation } from "#api/labels/errors";
import { findLabel } from "#api/labels/lib/find-label";
import { labelTable } from "#api/labels/tables";

/** Renames a label or changes its colour; every task shows the change at once. */
export async function updateLabel(
  workspaceId: string,
  labelId: string,
  changes: { name?: string; color?: string },
) {
  try {
    const { txid } = await withTxid(async (tx) => {
      await findLabel(tx, workspaceId, labelId);
      await tx
        .update(labelTable)
        .set({
          ...(changes.name !== undefined && { name: changes.name }),
          ...(changes.color !== undefined && { color: changes.color }),
        })
        .where(eq(labelTable.id, labelId));
    });
    return { txid };
  } catch (error) {
    rethrowLabelViolation(error);
  }
}
