import { useQuery } from "@tanstack/react-query";
import { rpc } from "@/app/lib/orpc";

export type WorkspaceRole = {
  id: string;
  workspaceId: string;
  role: string;
  permission: Record<string, string[]>;
  createdAt: Date | string;
  updatedAt?: Date | string | null;
};

function parsePermission(raw: unknown): Record<string, string[]> {
  if (raw && typeof raw === "object") {
    return raw as Record<string, string[]>;
  }
  if (typeof raw !== "string") {
    return {};
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, string[]>;
    }
    return {};
  } catch {
    return {};
  }
}

export function useWorkspaceRoles(workspaceId: string | undefined) {
  return useQuery<WorkspaceRole[]>({
    queryKey: ["workspace-roles", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      if (!workspaceId) return [];
      const roles = await rpc.members.roles.list({ workspaceId });

      return roles.map((r) => ({
        id: r.id,
        workspaceId: r.organizationId,
        role: r.role,
        permission: parsePermission(r.permission),
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }));
    },
  });
}
