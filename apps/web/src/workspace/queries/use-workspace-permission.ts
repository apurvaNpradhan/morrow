import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useActiveWorkspace } from "./use-active-workspace";
import { useGetActiveWorkspaceUser } from "@/members";
import { rpc } from "@/app/lib/orpc";

// Capabilities are named permission bundles checked against the SERVER via
// the API's `workspace.can` procedure. Going through the
// server is what makes custom workspace roles work in the UI: the local
// `checkRolePermission` only knows about the four static roles compiled
// into the auth client, so it would silently return false for any custom
// role that grants the permission.
const CAPABILITIES = {
  manageWorkspace: { workspace: ["update", "manage_settings"] },
  manageSettings: { workspace: ["manage_settings"] },
  deleteWorkspace: { workspace: ["delete"] },
  inviteUsers: { invitation: ["create"] },
  manageTeam: { member: ["update", "delete"] },
  updateMembers: { member: ["update"] },
  removeMembers: { member: ["delete"] },
  // Better Auth guards role administration with its access-control resource.
  manageRoles: { ac: ["create", "update", "delete"] },
} as const satisfies Record<string, Record<string, string[]>>;

type Capability = keyof typeof CAPABILITIES;

type CapabilityMap = Record<Capability, boolean>;

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

  // One query that fans out to all capability checks in parallel and caches
  // the resulting map by (workspaceId, role). Refetches when either changes,
  // e.g., when the admin edits the role's permissions in the Roles UI and
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
    queryFn: async (): Promise<CapabilityMap> => {
      const entries = Object.entries(CAPABILITIES) as Array<
        [Capability, Record<string, string[]>]
      >;
      // A failed check fails the query: an all-denied map would be cached as
      // a success and hide every control until it goes stale.
      const results = await Promise.all(
        entries.map(async ([key, permissions]) => {
          const res = await rpc.workspace.can({
            workspaceId: workspaceId as string,
            permissions,
          });
          return [key, res.success] as const;
        }),
      );
      const map = emptyCapabilityMap();
      for (const [key, value] of results) {
        map[key] = value;
      }
      return map;
    },
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
      // Escape hatch for ad-hoc permission checks (uncached). Prefer adding
      // a capability above.
      hasPermission: async (permissions: Record<string, string[]>) => {
        try {
          if (!workspaceId) return false;
          const res = await rpc.workspace.can({ workspaceId, permissions });
          return res.success;
        } catch (error) {
          console.error("hasPermission check failed:", error);
          return false;
        }
      },
    };
  }, [can, workspaceId]);

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
