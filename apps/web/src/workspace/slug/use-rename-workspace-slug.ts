import { useMutation, useQueryClient } from "@tanstack/react-query";
import { rpc } from "@/app/lib/orpc";
import { refreshSlugLookups } from "@/workspace/routing/workspace-by-slug-query";

export function useRenameWorkspaceSlug() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      workspaceId,
      slug,
    }: {
      workspaceId: string;
      slug: string;
    }) => rpc.workspace.renameSlug({ workspaceId, slug }),
    onSuccess: async () => {
      // Every cached slug lookup is now wrong: the old slug points at the new
      // one and, when renaming back, the reverse. Stale answers would send the
      // router back and forth between the two URLs.
      await refreshSlugLookups(queryClient);
      await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
  });
}
