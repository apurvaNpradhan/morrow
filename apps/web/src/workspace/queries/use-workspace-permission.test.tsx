import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { useWorkspacePermission } from "./use-workspace-permission";

const { capabilities } = vi.hoisted(() => ({ capabilities: vi.fn() }));

vi.mock("./use-active-workspace", () => ({
  useActiveWorkspace: () => ({ data: { id: "workspace-1" } }),
}));
vi.mock("@/members/queries/use-active-workspace-user", () => ({
  useGetActiveWorkspaceUser: () => ({ data: { role: "member" } }),
}));
vi.mock("@/app/lib/orpc", () => ({
  rpc: { workspace: { capabilities } },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("useWorkspacePermission", () => {
  beforeEach(() => capabilities.mockReset());

  it("reads every capability from the server in one call", async () => {
    capabilities.mockResolvedValue({
      inviteUsers: true,
      deleteWorkspace: false,
    });

    const { result } = renderHook(() => useWorkspacePermission(), {
      wrapper: createWrapper(),
    });

    await waitFor(() =>
      expect(result.current.isCheckingPermissions).toBe(false),
    );
    expect(result.current.canInviteUsers()).toBe(true);
    expect(result.current.canDeleteWorkspace()).toBe(false);
    expect(result.current.canManageRoles()).toBe(false);
    expect(capabilities).toHaveBeenCalledTimes(1);
  });
});
