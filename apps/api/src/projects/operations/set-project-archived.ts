import { eq } from "drizzle-orm";
import { recordWorkspaceActivity } from "#api/activity/index";
import { withTxid } from "#api/platform/sync/with-txid";
import { projectError } from "#api/projects/errors";
import { lockProject } from "#api/projects/lib/lock-project";
import { projectTable } from "#api/projects/tables";

/**
 * Archives an active project or brings an archived one back. An archived
 * project is read-only until it is unarchived or deleted.
 */
export async function setProjectArchived(
  workspaceId: string,
  projectId: string,
  archived: boolean,
) {
  const { txid } = await withTxid(async (tx) => {
    const project = await lockProject(tx, workspaceId, projectId, {
      allowArchived: true,
    });
    if (archived && project.archivedAt) throw projectError("PROJECT_ARCHIVED");
    if (!archived && !project.archivedAt) {
      throw projectError("PROJECT_NOT_ARCHIVED");
    }
    await tx
      .update(projectTable)
      .set({ archivedAt: archived ? new Date() : null })
      .where(eq(projectTable.id, projectId));
    await recordWorkspaceActivity(
      {
        type: archived ? "project.archived" : "project.unarchived",
        workspaceId,
        projectId,
        projectKey: project.key,
        projectName: project.name,
      },
      tx,
    );
  });
  return { txid };
}
