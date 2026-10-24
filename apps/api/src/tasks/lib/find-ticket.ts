import { and, eq } from "drizzle-orm";
import type { DbOrTx } from "#api/members/index";
import { taskTable, taskTicketAliasTable } from "#api/tasks/tables";

/**
 * The id of the Task a Ticket number names in a Project: the live
 * `(project, number)` first, then the number a moved Task left behind. Undefined
 * when neither exists. The Task found may now be in another Project.
 */
export async function findTicketTaskId(
  tx: DbOrTx,
  projectId: string,
  number: number,
) {
  const [live] = await tx
    .select({ id: taskTable.id })
    .from(taskTable)
    .where(
      and(eq(taskTable.projectId, projectId), eq(taskTable.number, number)),
    );
  if (live) return live.id;
  const [alias] = await tx
    .select({ id: taskTicketAliasTable.taskId })
    .from(taskTicketAliasTable)
    .where(
      and(
        eq(taskTicketAliasTable.projectId, projectId),
        eq(taskTicketAliasTable.number, number),
      ),
    );
  return alias?.id;
}
