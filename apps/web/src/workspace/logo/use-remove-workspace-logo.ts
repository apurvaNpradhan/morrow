import { useMutation } from "@tanstack/react-query";
import { rpc } from "@/app/lib/orpc";
import { workspaceCollection } from "../collections/workspace-collection";

export function useRemoveWorkspaceLogo(workspaceId: string) {
  return useMutation({
    mutationFn: async () => {
      const removed = await rpc.workspace.removeLogo({ workspaceId });
      // Resolve once the change has come back through sync.
      if (removed.txid !== null) {
        await workspaceCollection.utils.awaitTxId(removed.txid);
      }
      return removed;
    },
  });
}
