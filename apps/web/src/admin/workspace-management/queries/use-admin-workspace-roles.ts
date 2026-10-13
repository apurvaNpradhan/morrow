import { useQuery } from "@tanstack/react-query";
import { rpc } from "@/app/lib/orpc";

export function useAdminWorkspaceRoles(workspaceId: string, enabled = true) {
  return useQuery({
    queryKey: ["admin", "workspace-roles", workspaceId],
    queryFn: () => rpc.admin.workspaces.roles({ workspaceId }),
    enabled: enabled && workspaceId !== "",
  });
}
