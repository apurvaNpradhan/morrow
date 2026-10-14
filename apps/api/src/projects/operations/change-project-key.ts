import { eq } from "drizzle-orm";
import { recordWorkspaceActivity } from "#api/activity/index";
import { withTxid } from "#api/platform/sync/with-txid";
import { rethrowViolation } from "#api/projects/errors";
import { lockProject } from "#api/projects/lib/lock-project";
import { projectTable } from "#api/projects/tables";

/**
 * Gives a project a new key. Old links stop working and no redirect is kept,
 * so the activity feed records the old key.
 */
export async function changeProjectKey(
  workspaceId: string,
  projectId: string,
  key: string,
) {
  try {
    let changed = true;
    const { txid } = await withTxid(async (tx) => {
      const project = await lockProject(tx, workspaceId, projectId);
      if (project.key === key) {
        changed = false;
        return;
      }
      await tx
        .update(projectTable)
        .set({ key })
        .where(eq(projectTable.id, projectId));
      await recordWorkspaceActivity(
        {
          type: "project.key_changed",
          workspaceId,
          projectId,
          previousKey: project.key,
          projectKey: key,
        },
        tx,
      );
    });
    // A key that did not change writes nothing, so there is nothing to wait for.
    return { txid: changed ? txid : null };
  } catch (error) {
    rethrowViolation(error, {
      project_workspace_key_uidx: "PROJECT_KEY_TAKEN",
    });
  }
}
