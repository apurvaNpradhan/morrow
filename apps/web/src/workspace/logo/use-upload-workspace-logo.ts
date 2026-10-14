import { useMutation } from "@tanstack/react-query";
import { prepareAvatarImage } from "@/account";
import { rpc } from "@/app/lib/orpc";
import { workspaceCollection } from "../collections/workspace-collection";

export function useUploadWorkspaceLogo(workspaceId: string) {
  return useMutation({
    mutationFn: async (file: File) => {
      const saved = await rpc.workspace.uploadLogo({
        workspaceId,
        file: await prepareAvatarImage(file),
      });
      // Resolve once the new logo has come back through sync.
      if (saved.txid !== null) {
        await workspaceCollection.utils.awaitTxId(saved.txid);
      }
      return saved;
    },
  });
}
