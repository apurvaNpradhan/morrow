import { eq } from "drizzle-orm";
import { withTxid } from "#api/platform/sync/with-txid";
import { lockProject } from "#api/projects/index";
import { findTask } from "#api/tasks/lib/find-task";
import { taskLinkTable } from "#api/tasks/tables";
import { findLink } from "../lib/find-link";

/** Detaches a link from a task. */
export async function removeLink(
  workspaceId: string,
  projectId: string,
  taskId: string,
  linkId: string,
) {
  const { txid } = await withTxid(async (tx) => {
    await lockProject(tx, workspaceId, projectId);
    await findTask(tx, projectId, taskId);
    await findLink(tx, projectId, taskId, linkId);
    await tx.delete(taskLinkTable).where(eq(taskLinkTable.id, linkId));
  });
  return { txid };
}
