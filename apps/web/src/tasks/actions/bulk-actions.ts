import {
  nextCompletedAt,
  type ProjectColumnRow,
  type TaskRow,
} from "@morrow/sync-schemas";
import { createOptimisticAction } from "@tanstack/react-db";
import { generateNKeysBetween } from "fractional-indexing";
import { rpc } from "@/app/lib/orpc";
import { taskCollection } from "../collections/task-collection";
import { workspaceOf } from "../collections/task-writes";
import { dueFields, startFields, startsAfterDue } from "../lib/due-date";
import { columnTasks } from "../queries/task-queries";

export type BulkChange = Parameters<typeof rpc.tasks.bulkUpdate>[0]["change"];

type Batch = {
  projectId: string;
  /** In the order the user saw them; `move` keeps it. */
  taskIds: string[];
  columnById: ReadonlyMap<string, ProjectColumnRow>;
};

/** Positions after every task the column holds in memory, one per moving task. */
function endPositions(columnId: string, count: number) {
  const last = taskCollection.toArray
    .filter((task) => task.columnId === columnId)
    .reduce<string | null>(
      (max, task) =>
        max === null || task.position > max ? task.position : max,
      null,
    );
  return generateNKeysBetween(last, null, count);
}

function applyChange(batch: Batch, change: BulkChange, drafts: TaskRow[]) {
  const now = new Date();
  if (change.type === "move") {
    const to = batch.columnById.get(change.columnId);
    if (!to) return;
    const moving = drafts.filter((draft) => draft.columnId !== to.id);
    const positions = endPositions(to.id, moving.length);
    for (const [index, draft] of moving.entries()) {
      const from = batch.columnById.get(draft.columnId);
      draft.completedAt = nextCompletedAt(
        draft.completedAt,
        from?.category ?? to.category,
        to.category,
        now,
      );
      draft.columnId = to.id;
      draft.position = positions[index]!;
    }
    return;
  }
  for (const draft of drafts) {
    if (change.type === "priority") draft.priority = change.priority;
    else if (change.type === "assignee") draft.assigneeId = change.assigneeId;
    else if (change.type === "startDate") {
      Object.assign(draft, startFields(change.startDate));
    } else if (change.type === "dueDate") {
      Object.assign(draft, dueFields(change.dueDate));
      // A due date before the start takes the start with it.
      if (startsAfterDue(draft)) Object.assign(draft, startFields(null));
    } else if (change.type === "addLabel") {
      if (!draft.labelIds.includes(change.labelId)) {
        draft.labelIds = [...draft.labelIds, change.labelId];
      }
    } else if (change.type === "removeLabel") {
      draft.labelIds = draft.labelIds.filter((id) => id !== change.labelId);
    } else if (change.type === "archive") {
      if ((draft.archivedAt !== null) !== change.archived) {
        draft.archivedAt = change.archived ? now : null;
      }
    }
  }
}

const bulkUpdateAction = createOptimisticAction<Batch & { change: BulkChange }>(
  {
    onMutate: (batch) => {
      const keys = batch.taskIds.filter((id) => taskCollection.has(id));
      if (keys.length === 0) return;
      // `update` hands the drafts over in the order of `keys`.
      taskCollection.update(keys, (drafts) =>
        applyChange(batch, batch.change, drafts as TaskRow[]),
      );
    },
    mutationFn: async (batch) => {
      const { txid } = await rpc.tasks.bulkUpdate({
        workspaceId: workspaceOf(batch.projectId),
        projectId: batch.projectId,
        taskIds: batch.taskIds,
        change: batch.change,
      });
      await taskCollection.utils.awaitTxId(txid);
    },
  },
);

/** Filled in by the server: how many ids were already gone. */
type Removed = { skipped: number };

const bulkRemoveAction = createOptimisticAction<Batch & { result: Removed }>({
  onMutate: (batch) => {
    const keys = batch.taskIds.filter((id) => taskCollection.has(id));
    if (keys.length > 0) taskCollection.delete(keys);
  },
  mutationFn: async (batch) => {
    const { txid, skipped } = await rpc.tasks.bulkRemove({
      workspaceId: workspaceOf(batch.projectId),
      projectId: batch.projectId,
      taskIds: batch.taskIds,
    });
    batch.result.skipped = skipped;
    await taskCollection.utils.awaitTxId(txid);
  },
});

/**
 * Applies one change to many tasks as one write: it shows at once, and either
 * every task changes on the server or the whole batch rolls back and this
 * rejects.
 */
export async function bulkUpdateTasks(
  batch: Batch,
  change: BulkChange,
): Promise<void> {
  // A move lands after the last task of the column, so load what it holds.
  if (change.type === "move") await columnTasks(change.columnId).preload();
  await bulkUpdateAction({ ...batch, change }).isPersisted.promise;
}

/**
 * Deletes many tasks as one write, with the same all-or-nothing outcome.
 * Resolves with how many were really deleted; someone else may have got there.
 */
export async function bulkRemoveTasks(batch: Batch): Promise<number> {
  const result: Removed = { skipped: 0 };
  await bulkRemoveAction({ ...batch, result }).isPersisted.promise;
  return batch.taskIds.length - result.skipped;
}
