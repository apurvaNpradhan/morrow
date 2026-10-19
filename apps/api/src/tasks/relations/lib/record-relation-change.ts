import { ticketId, type RelationType } from "@morrow/sync-schemas";
import type { DbOrTx } from "#api/members/index";
import { recordTaskEvent } from "#api/tasks/history/record-task-event";

type RelatedTask = {
  id: string;
  number: number;
  projectId: string;
  projectKey: string;
};

/**
 * Writes a relation being added or removed to the history of both its tasks,
 * each in its own Project. The other task's ticket id is a snapshot, and the
 * direction is as the task itself sees it.
 */
export async function recordRelationChange(
  tx: DbOrTx,
  change: "relation_added" | "relation_removed",
  type: RelationType,
  source: RelatedTask,
  target: RelatedTask,
) {
  const ticket = (task: RelatedTask) => ticketId(task.projectKey, task.number);
  await recordTaskEvent(tx, source.projectId, source.id, {
    type: change,
    data: { type, direction: "outgoing", ticketId: ticket(target) },
  });
  await recordTaskEvent(tx, target.projectId, target.id, {
    type: change,
    data: { type, direction: "incoming", ticketId: ticket(source) },
  });
}
