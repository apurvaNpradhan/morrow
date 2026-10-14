import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  CAPABILITIES,
  type Capability,
  type CapabilityMap,
} from "@morrow/permissions/capabilities";
import { useActiveWorkspace } from "./use-active-workspace";
import { useGetActiveWorkspaceUser } from "@/members";
import { rpc } from "@/app/lib/orpc";

// Capabilities are named permission bundles (see `@morrow/permissions`)
// checked against the SERVER, so custom workspace roles work in the UI: the
// local `checkRolePermission` only knows the four static roles compiled into
// the auth client. One call answers all of them.
function emptyCapabilityMap(): CapabilityMap {
  const out = {} as CapabilityMap;
  for (const key of Object.keys(CAPABILITIES) as Capability[]) {
    out[key] = false;
  }
  return out;
}

export function useWorkspacePermission() {
  const { data: activeWorkspace } = useActiveWorkspace();
  const { data: activeMember } = useGetActiveWorkspaceUser();
  const workspaceId = activeWorkspace?.id;
  const role = activeMember?.role as string | undefined;

  // One query that returns every capability, cached by (workspaceId, role).
  // Refetches when either changes, e.g., when the admin edits the role's permissions in the Roles UI and
  // we invalidate this key.
  const {
    data: capabilities,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ["workspace-capabilities", workspaceId, role],
    enabled: Boolean(workspaceId && role),
    staleTime: 5 * 60 * 1000,
    // Unlike the default, retry network blips: a missing map hides controls.
    retry: 2,
    queryFn: async (): Promise<CapabilityMap> => ({
      ...emptyCapabilityMap(),
      ...(await rpc.workspace.capabilities({
        workspaceId: workspaceId as string,
      })),
    }),
  });

  const can: CapabilityMap = capabilities ?? emptyCapabilityMap();

  const helpers = useMemo(() => {
    return {
      canManageWorkspace: () => can.manageWorkspace,
      canManageSettings: () => can.manageSettings,
      canDeleteWorkspace: () => can.deleteWorkspace,
      canInviteUsers: () => can.inviteUsers,
      canManageTeam: () => can.manageTeam,
      canUpdateMembers: () => can.updateMembers,
      canRemoveMembers: () => can.removeMembers,
      canManageRoles: () => can.manageRoles,
      canCreateProjects: () => can.createProjects,
      canManageProjects: () => can.manageProjects,
      canDeleteProjects: () => can.deleteProjects,
    };
  }, [can]);

  return {
    ...helpers,
    workspace: activeWorkspace,
    member: activeMember,
    role,
    isOwner: role === "owner",
    isAdmin: role === "owner" || role === "admin",
    // True while the first capability fetch is in flight. Useful for hiding
    // action UI during the initial render instead of flashing it on then
    // off when the server check resolves.
    isCheckingPermissions:
      Boolean(workspaceId && role) && (isLoading || !capabilities),
    isRefetchingPermissions: isFetching,
  };
}
