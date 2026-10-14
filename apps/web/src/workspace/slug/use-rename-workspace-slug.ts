import { useMutation } from "@tanstack/react-query";
import { rpc } from "@/app/lib/orpc";
import { workspaceCollection } from "../collections/workspace-collection";

export function useRenameWorkspaceSlug() {
  return useMutation({
    mutationFn: async ({
      workspaceId,
      slug,
    }: {
      workspaceId: string;
      slug: string;
    }) => {
      const renamed = await rpc.workspace.renameSlug({ workspaceId, slug });
      // Resolve once the new slug has come back through sync, so the page the
      // caller opens next finds the workspace under it.
      if (renamed.txid !== null) {
        await workspaceCollection.utils.awaitTxId(renamed.txid);
      }
      return renamed;
    },
  });
}
