import { eq } from "drizzle-orm";
import { withTxid } from "#api/platform/sync/with-txid";
import { rethrowViolation } from "#api/projects/errors";
import { lockProject } from "#api/projects/lib/lock-project";
import { assertValidPosition } from "#api/projects/lib/position";
import { projectFieldTable } from "#api/projects/tables";
import { findField } from "../lib/find-field";

/** Moves a Field to the position the client chose. */
export async function moveField(
  workspaceId: string,
  projectId: string,
  fieldId: string,
  position: string,
) {
  assertValidPosition(position);
  try {
    const { txid } = await withTxid(async (tx) => {
      await lockProject(tx, workspaceId, projectId);
      await findField(tx, projectId, fieldId);
      await tx
        .update(projectFieldTable)
        .set({ position })
        .where(eq(projectFieldTable.id, fieldId));
    });
    return { txid };
  } catch (error) {
    rethrowViolation(error, {
      project_field_position_uidx: "POSITION_TAKEN",
    });
  }
}
