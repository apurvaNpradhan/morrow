import { ticketId } from "@morrow/sync-schemas";
import { recordWorkspaceActivity } from "#api/activity/index";
import type { DbOrTx } from "#api/members/index";

type TaskActivity =
  | "task.created"
  | "task.completed"
  | "task.canceled"
  | "task.deleted";

/** Records one task event in the caller's transaction. */
export function recordTaskActivity(
  tx: DbOrTx,
  type: TaskActivity,
  workspaceId: string,
  project: { id: string; key: string },
  task: { id: string; number: number; title: string },
) {
  return recordWorkspaceActivity(
    {
      type,
      workspaceId,
      projectId: project.id,
      taskId: task.id,
      ticketId: ticketId(project.key, task.number),
      taskTitle: task.title,
    },
    tx,
  );
}
