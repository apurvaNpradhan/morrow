import { useQuery } from "@tanstack/react-query";
import { rpc } from "@/app/lib/orpc";

export function adminWorkspaceMembersQueryKey(workspaceId: string) {
  return ["admin", "workspace-members", workspaceId] as const;
}

export function useAdminWorkspaceMembers(workspaceId: string, enabled = true) {
  return useQuery({
    queryKey: adminWorkspaceMembersQueryKey(workspaceId),
    queryFn: () => rpc.admin.workspaces.members({ workspaceId }),
    enabled: enabled && workspaceId !== "",
  });
}
