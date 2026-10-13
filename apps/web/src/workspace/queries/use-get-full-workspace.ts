import { useQuery } from "@tanstack/react-query";
import { rpc } from "@/app/lib/orpc";

type GetFullWorkspaceRequest = {
  workspaceId?: string;
  workspaceSlug?: string;
  membersLimit?: number;
};

export function useGetFullWorkspace({
  workspaceId,
  workspaceSlug,
  membersLimit = 100,
}: GetFullWorkspaceRequest) {
  return useQuery({
    queryKey: ["workspace", "full", workspaceId || workspaceSlug],
    enabled: !!workspaceId,
    queryFn: () => {
      if (!workspaceId) throw new Error("A workspace is required");
      return rpc.workspace.full({ workspaceId, membersLimit });
    },
  });
}
