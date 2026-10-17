import { and, eq } from "drizzle-orm";
import type { DbOrTx } from "#api/members/index";
import { linkNotFound } from "#api/tasks/errors";
import { taskLinkTable } from "#api/tasks/tables";

/** A link of this task of this project; any other link is "not found". */
export async function findLink(
  tx: DbOrTx,
  projectId: string,
  taskId: string,
  linkId: string,
) {
  const [link] = await tx
    .select()
    .from(taskLinkTable)
    .where(
      and(
        eq(taskLinkTable.id, linkId),
        eq(taskLinkTable.taskId, taskId),
        eq(taskLinkTable.projectId, projectId),
      ),
    );
  if (!link) throw linkNotFound();
  return link;
}
