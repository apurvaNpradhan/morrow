import { eq } from "drizzle-orm";
import { withTxid } from "#api/platform/sync/with-txid";
import { lockProject } from "#api/projects/lib/lock-project";
import { projectTable } from "#api/projects/tables";
import { removeOwnedImage } from "#api/storage/index";

/**
 * The one writer of `project.backgroundUrl`. Swaps it under the project's row
 * lock, then deletes the object the project had before (queued for retry if
 * the delete fails). Only objects under this project's own folder are deleted.
 */
export async function setProjectBackground(
  workspaceId: string,
  projectId: string,
  backgroundUrl: string | null,
) {
  const { result: before, txid } = await withTxid(async (tx) => {
    const project = await lockProject(tx, workspaceId, projectId);
    await tx
      .update(projectTable)
      .set({ backgroundUrl })
      .where(eq(projectTable.id, projectId));
    return project.backgroundUrl;
  });
  const hadBackground = await removeOwnedImage(
    before,
    "project-backgrounds",
    projectId,
  );
  return { hadBackground, txid };
}
