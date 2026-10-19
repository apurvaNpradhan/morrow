import { ticketId } from "@morrow/sync-schemas";
import type { DbOrTx } from "#api/members/index";
import { recordTaskEvent } from "./record-task-event";

type TaskRef = { id: string; number: number };

/**
 * Writes a task's move between parents to the history of everyone involved:
 * the child's `parent` entry, and `subtask_removed` / `subtask_added` on the
 * old and the new parent. Ticket ids are snapshots.
 */
export async function recordParentChange(
  tx: DbOrTx,
  project: { id: string; key: string },
  child: TaskRef,
  from: TaskRef | null,
  to: TaskRef | null,
) {
  if (from?.id === to?.id) return;
  const ticket = (task: TaskRef) => ticketId(project.key, task.number);
  await recordTaskEvent(tx, project.id, child.id, {
    type: "parent",
    data: { from: from ? ticket(from) : null, to: to ? ticket(to) : null },
  });
  if (from) {
    await recordTaskEvent(tx, project.id, from.id, {
      type: "subtask_removed",
      data: { ticketId: ticket(child) },
    });
  }
  if (to) {
    await recordTaskEvent(tx, project.id, to.id, {
      type: "subtask_added",
      data: { ticketId: ticket(child) },
    });
  }
}
