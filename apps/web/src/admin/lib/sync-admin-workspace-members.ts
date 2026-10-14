import type { QueryClient } from "@tanstack/react-query";
import type { AdminWorkspaceMember } from "./admin-types";
import { adminWorkspaceMembersQueryKey } from "@/admin/workspace-management/queries/use-admin-workspace-members";
import { ADMIN_WORKSPACES_QUERY_KEY } from "@/admin/workspace-management/queries/use-admin-workspaces";

export function syncAdminWorkspaceMembers(
  queryClient: QueryClient,
  workspaceId: string,
  members: AdminWorkspaceMember[],
) {
  queryClient.setQueryData(adminWorkspaceMembersQueryKey(workspaceId), members);
  queryClient.invalidateQueries({ queryKey: ADMIN_WORKSPACES_QUERY_KEY });
}
