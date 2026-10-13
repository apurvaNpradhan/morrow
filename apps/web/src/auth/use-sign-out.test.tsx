import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const { navigate, signOut } = vi.hoisted(() => ({
  navigate: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));
vi.mock("./lib/auth-client", () => ({ authClient: { signOut } }));

import { useSignOut } from "./use-sign-out";

describe("useSignOut", () => {
  beforeEach(() => {
    navigate.mockReset();
    signOut.mockReset();
  });

  it("clears user-scoped queries before redirecting", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["notifications", "w1"], { private: true });
    let cachedAtRedirect: unknown = "unset";
    navigate.mockImplementation(() => {
      cachedAtRedirect = queryClient.getQueryData(["notifications", "w1"]);
    });
    signOut.mockImplementation(async ({ fetchOptions }) => {
      fetchOptions.onSuccess();
      return { data: { success: true }, error: null };
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useSignOut(), { wrapper });
    await act(async () => {
      result.current.mutate();
    });

    await waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(cachedAtRedirect).toBeUndefined();
  });

  it("keeps the cache when sign-out fails", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["notifications", "w1"], { private: true });
    signOut.mockResolvedValue({ data: null, error: { message: "nope" } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useSignOut(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync().catch(() => undefined);
    });

    expect(queryClient.getQueryData(["notifications", "w1"])).toBeDefined();
  });
});
