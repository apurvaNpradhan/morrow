import { eq } from "drizzle-orm";
import { recordWorkspaceActivity } from "#api/activity/index";
import { withTxid } from "#api/platform/sync/with-txid";
import { removeOwnedImage } from "#api/storage/index";
import { lockProject } from "#api/projects/lib/lock-project";
import { projectTable } from "#api/projects/tables";

/**
 * Deletes a project with its columns and tasks, then its background image
 * (queued for retry if the storage delete fails). The web app asks for the
 * project's key first, so deletion is deliberate.
 */
export async function deleteProject(workspaceId: string, projectId: string) {
  const { result: project, txid } = await withTxid(async (tx) => {
    const locked = await lockProject(tx, workspaceId, projectId, {
      allowArchived: true,
    });
    await tx.delete(projectTable).where(eq(projectTable.id, projectId));
    await recordWorkspaceActivity(
      {
        type: "project.deleted",
        workspaceId,
        projectId,
        projectKey: locked.key,
        projectName: locked.name,
      },
      tx,
    );
    return locked;
  });
  await removeOwnedImage(
    project.backgroundUrl,
    "project-backgrounds",
    projectId,
  );
  return { txid };
}
