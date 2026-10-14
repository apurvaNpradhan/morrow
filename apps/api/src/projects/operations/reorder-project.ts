import { eq } from "drizzle-orm";
import { withTxid } from "#api/platform/sync/with-txid";
import { projectError, violatedConstraint } from "#api/projects/errors";
import { assertValidPosition } from "#api/projects/lib/position";
import { lockProject } from "#api/projects/lib/lock-project";
import { projectTable } from "#api/projects/tables";

/**
 * Moves a project to a position the client computed from its neighbours. Two
 * people landing on the same spot at once collide on the unique index; the
 * later one is told to try again.
 */
export async function reorderProject(
  workspaceId: string,
  projectId: string,
  position: string,
) {
  assertValidPosition(position);
  try {
    const { txid } = await withTxid(async (tx) => {
      await lockProject(tx, workspaceId, projectId);
      await tx
        .update(projectTable)
        .set({ position })
        .where(eq(projectTable.id, projectId));
    });
    return { txid };
  } catch (error) {
    if (violatedConstraint(error) === "project_workspace_position_uidx") {
      throw projectError("POSITION_TAKEN");
    }
    throw error;
  }
}
