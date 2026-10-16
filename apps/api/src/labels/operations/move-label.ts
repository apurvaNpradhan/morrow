import { eq } from "drizzle-orm";
import { withTxid } from "#api/platform/sync/with-txid";
import { assertValidPosition } from "#api/projects/index";
import { rethrowLabelViolation } from "#api/labels/errors";
import { findLabel } from "#api/labels/lib/find-label";
import { labelTable } from "#api/labels/tables";

/** Puts a label at a position the client computed among the Workspace's labels. */
export async function moveLabel(
  workspaceId: string,
  labelId: string,
  position: string,
) {
  assertValidPosition(position);
  try {
    const { txid } = await withTxid(async (tx) => {
      await findLabel(tx, workspaceId, labelId);
      await tx
        .update(labelTable)
        .set({ position })
        .where(eq(labelTable.id, labelId));
    });
    return { txid };
  } catch (error) {
    rethrowLabelViolation(error);
  }
}
