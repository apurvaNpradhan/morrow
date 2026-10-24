import { createOptimisticAction } from "@tanstack/react-db";
import { rpc } from "@/app/lib/orpc";
import { taskCollection } from "../collections/task-collection";

export type MoveInput = {
  workspaceId: string;
  toProjectId: string;
  /** The Tasks the caller picked; with `withSubtasks` their trees go too. */
  taskIds: string[];
  /** A Column of the destination for the picked Tasks. */
  columnId?: string;
  withSubtasks: boolean;
  /** Where each Task is expected to land, so the move shows at once. */
  placements: ReadonlyMap<
    string,
    { columnId: string; parentId: string | null }
  >;
};

export type MoveResult = Awaited<ReturnType<typeof rpc.tasks.moveToProject>>;

type Run = MoveInput & { out: { result?: MoveResult } };

/** The move on the server, and the wait for sync to bring it back. */
async function send(input: MoveInput) {
  const result = await rpc.tasks.moveToProject({
    workspaceId: input.workspaceId,
    toProjectId: input.toProjectId,
    taskIds: input.taskIds,
    columnId: input.columnId,
    withSubtasks: input.withSubtasks,
  });
  await taskCollection.utils.awaitTxId(result.txid);
  return result;
}

const moveAction = createOptimisticAction<Run>({
  onMutate: ({ placements, toProjectId }) => {
    const keys = [...placements.keys()].filter((id) => taskCollection.has(id));
    // `update` hands the drafts over in the order of `keys`.
    taskCollection.update(keys, (drafts) => {
      for (const [index, draft] of drafts.entries()) {
        const placement = placements.get(keys[index]!)!;
        draft.projectId = toProjectId;
        draft.columnId = placement.columnId;
        draft.parentId = placement.parentId;
        // The server numbers it; until then the card shows the key and an ellipsis.
        draft.number = 0;
      }
    });
  },
  mutationFn: async ({ out, ...input }) => {
    out.result = await send(input);
  },
});

/**
 * Moves Tasks to another Project of the Workspace. The cards show in their new
 * place at once; this resolves with the server's account of what moved once
 * sync has delivered it, and rejects, rolling the cards back, if it refuses.
 */
export async function moveTasksToProject(input: MoveInput) {
  // An optimistic action with nothing to change has nothing to persist and
  // never calls the server, so a move of Tasks that are not loaded goes direct.
  if (![...input.placements.keys()].some((id) => taskCollection.has(id))) {
    return send(input);
  }
  const out: Run["out"] = {};
  await moveAction({ ...input, out }).isPersisted.promise;
  return out.result!;
}
