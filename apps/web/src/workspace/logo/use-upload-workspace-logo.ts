import { useMutation, useQueryClient } from "@tanstack/react-query";
import { prepareAvatarImage } from "@/account";
import { rpc } from "@/app/lib/orpc";
import { invalidateWorkspaceDetails } from "@/workspace/cache/invalidate-workspace-queries";

export function useUploadWorkspaceLogo(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) =>
      rpc.workspace.uploadLogo({
        workspaceId,
        file: await prepareAvatarImage(file),
      }),
    onSuccess: () => invalidateWorkspaceDetails(queryClient),
  });
}
