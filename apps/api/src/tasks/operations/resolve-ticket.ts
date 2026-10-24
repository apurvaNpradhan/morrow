import { parseTicketId, ticketId } from "@morrow/sync-schemas";
import { and, eq } from "drizzle-orm";
import { db } from "#api/platform/database/index";
import { projectNotFound, projectTable } from "#api/projects/index";
import { taskNotFound } from "#api/tasks/errors";
import { findTicketTaskId } from "#api/tasks/lib/find-ticket";
import { taskTable } from "#api/tasks/tables";

/**
 * The Task a Ticket id of this Project names, with the Ticket id and Project it
 * has now. A Task that moved away answers to its old id, so the caller can
 * follow it to the new one.
 */
export async function resolveTicket(
  workspaceId: string,
  projectId: string,
  ticket: string,
) {
  const parsed = parseTicketId(ticket);
  const [project] = await db
    .select({ id: projectTable.id, key: projectTable.key })
    .from(projectTable)
    .where(
      and(
        eq(projectTable.id, projectId),
        eq(projectTable.workspaceId, workspaceId),
      ),
    );
  if (!project) throw projectNotFound();
  if (!parsed || parsed.key !== project.key) throw taskNotFound();
  const taskId = await findTicketTaskId(db, projectId, parsed.number);
  if (!taskId) throw taskNotFound();
  const [task] = await db
    .select({
      id: taskTable.id,
      projectId: taskTable.projectId,
      number: taskTable.number,
      key: projectTable.key,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
    .where(
      and(eq(taskTable.id, taskId), eq(projectTable.workspaceId, workspaceId)),
    );
  if (!task) throw taskNotFound();
  return {
    id: task.id,
    projectId: task.projectId,
    ticketId: ticketId(task.key, task.number),
  };
}
