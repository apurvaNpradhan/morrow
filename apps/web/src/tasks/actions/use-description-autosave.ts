import { checklistCounts, type TaskDescriptionRow } from "@morrow/sync-schemas";
import { debounceStrategy, usePacedMutations } from "@tanstack/react-db";
import { rpc } from "@/app/lib/orpc";
import { taskCollection } from "../collections/task-collection";
import { taskDescriptionCollection } from "../collections/task-description-collection";
import { workspaceOf } from "../collections/task-writes";

/**
 * Saves a task's description a second after the last keystroke, so a long edit
 * is not lost to a closed tab and each keystroke is not a request. The text
 * shows at once; writes go out one after another, and the last one wins (there
 * is no collaborative editing). A pending save outlives the sheet that made it.
 */
export function useDescriptionAutosave(taskId: string) {
  return usePacedMutations<string, TaskDescriptionRow>({
    onMutate: (description) => {
      // The task may have been deleted, with its description, while the sheet
      // was open; there is nothing left to save to.
      if (!taskDescriptionCollection.has(taskId)) return;
      taskDescriptionCollection.update(taskId, (draft) => {
        draft.description = description;
      });
      // The card's checklist progress follows the text at once; the server
      // writes the same counts with the description.
      if (taskCollection.has(taskId)) {
        const { done, total } = checklistCounts(description);
        taskCollection.update(taskId, (draft) => {
          draft.checklistDone = done;
          draft.checklistTotal = total;
        });
      }
    },
    mutationFn: async ({ transaction }) => {
      for (const mutation of transaction.mutations) {
        // Only description edits are sent; the task's counts come back with them.
        if (
          mutation.type !== "update" ||
          mutation.collection !== taskDescriptionCollection
        ) {
          continue;
        }
        const { txid } = await rpc.tasks.updateDescription({
          workspaceId: workspaceOf(mutation.modified.projectId),
          projectId: mutation.modified.projectId,
          taskId: mutation.modified.taskId,
          description: mutation.modified.description,
        });
        if (txid !== null) {
          await Promise.all([
            taskDescriptionCollection.utils.awaitTxId(txid),
            taskCollection.utils.awaitTxId(txid),
          ]);
        }
      }
    },
    strategy: debounceStrategy({ wait: 1000 }),
  });
}
