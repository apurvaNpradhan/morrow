import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/auth";
import { useActiveWorkspace } from "@/workspace";
import { rpc } from "@/app/lib/orpc";

export const useGetActiveWorkspaceUser = () => {
  const { user } = useAuth();
  const { data: workspace } = useActiveWorkspace();

  return useQuery({
    queryKey: ["workspace-user", "active", workspace?.id, user?.id],
    enabled: !!workspace?.id && !!user?.id,
    queryFn: () =>
      rpc.members.current({ workspaceId: workspace?.id as string }),
  });
};
