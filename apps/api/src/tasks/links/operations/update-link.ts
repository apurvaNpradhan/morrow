import { eq } from "drizzle-orm";
import { withTxid } from "#api/platform/sync/with-txid";
import { lockProject } from "#api/projects/index";
import { rethrowTaskViolation } from "#api/tasks/errors";
import { findTask } from "#api/tasks/lib/find-task";
import { taskLinkTable } from "#api/tasks/tables";
import { findLink } from "../lib/find-link";

/**
 * Changes a link's URL, its title, or both; a field left out stays. Pointing it
 * at a URL the task already has is refused (`LINK_URL_TAKEN`).
 */
export async function updateLink(
  workspaceId: string,
  projectId: string,
  taskId: string,
  linkId: string,
  changes: { url?: string; title?: string | null },
) {
  try {
    const { txid } = await withTxid(async (tx) => {
      await lockProject(tx, workspaceId, projectId);
      await findTask(tx, projectId, taskId);
      await findLink(tx, projectId, taskId, linkId);
      await tx
        .update(taskLinkTable)
        .set({
          ...(changes.url !== undefined && { url: changes.url }),
          ...(changes.title !== undefined && { title: changes.title }),
        })
        .where(eq(taskLinkTable.id, linkId));
    });
    return { txid };
  } catch (error) {
    rethrowTaskViolation(error);
  }
}
