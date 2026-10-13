import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { useWorkspacePermission } from "./use-workspace-permission";

const { can } = vi.hoisted(() => ({ can: vi.fn() }));

vi.mock("./use-active-workspace", () => ({
  useActiveWorkspace: () => ({ data: { id: "workspace-1" } }),
}));
vi.mock("@/members/queries/use-active-workspace-user", () => ({
  useGetActiveWorkspaceUser: () => ({ data: { role: "member" } }),
}));
vi.mock("@/app/lib/orpc", () => ({
  rpc: { workspace: { can } },
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
  beforeEach(() => can.mockReset());

  it("checks workspace and member capabilities through the server", async () => {
    can.mockImplementation(
      async (input?: { permissions: Record<string, string[]> }) => ({
        success:
          input?.permissions.workspace?.includes("read") === true ||
          input?.permissions.invitation?.includes("create") === true,
      }),
    );

    const { result } = renderHook(() => useWorkspacePermission(), {
      wrapper: createWrapper(),
    });

    await waitFor(() =>
      expect(result.current.isCheckingPermissions).toBe(false),
    );
    expect(result.current.canInviteUsers()).toBe(true);
    expect(result.current.canDeleteWorkspace()).toBe(false);
  });
});
