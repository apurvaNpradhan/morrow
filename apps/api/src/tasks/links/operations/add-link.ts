import { LINK_ID_PATTERN, LINKS_PER_TASK_MAX } from "@morrow/sync-schemas";
import { and, count, eq } from "drizzle-orm";
import { withTxid } from "#api/platform/sync/with-txid";
import { lockProject } from "#api/projects/index";
import { rethrowTaskViolation, taskError } from "#api/tasks/errors";
import { findTask } from "#api/tasks/lib/find-task";
import { taskLinkTable } from "#api/tasks/tables";

/**
 * Attaches a URL to a task. The id comes from the browser so the link can
 * appear before the server answers. A URL the task already has is not added
 * again: the existing link is returned and nothing is written (`txid` null).
 * Runs under the project lock, so an archived Project refuses it.
 */
export async function addLink(
  workspaceId: string,
  projectId: string,
  taskId: string,
  userId: string,
  input: { id: string; url: string; title: string | null },
) {
  if (!LINK_ID_PATTERN.test(input.id)) throw taskError("INVALID_LINK_ID");
  try {
    const { result, txid } = await withTxid(async (tx) => {
      await lockProject(tx, workspaceId, projectId);
      await findTask(tx, projectId, taskId);
      const [existing] = await tx
        .select({ id: taskLinkTable.id })
        .from(taskLinkTable)
        .where(
          and(
            eq(taskLinkTable.taskId, taskId),
            eq(taskLinkTable.url, input.url),
          ),
        );
      if (existing) return { id: existing.id, written: false };
      const [{ total } = { total: 0 }] = await tx
        .select({ total: count() })
        .from(taskLinkTable)
        .where(eq(taskLinkTable.taskId, taskId));
      if (total >= LINKS_PER_TASK_MAX) throw taskError("TOO_MANY_LINKS");
      await tx.insert(taskLinkTable).values({
        id: input.id,
        taskId,
        projectId,
        url: input.url,
        title: input.title,
        createdBy: userId,
      });
      return { id: input.id, written: true };
    });
    return { id: result.id, txid: result.written ? txid : null };
  } catch (error) {
    rethrowTaskViolation(error);
  }
}
