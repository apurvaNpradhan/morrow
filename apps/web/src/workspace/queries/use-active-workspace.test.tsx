import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import { useActiveWorkspace } from "./use-active-workspace";

// A `/$slug` route whose slug did not resolve: it matches, but its context has
// no workspace.
vi.mock("@tanstack/react-router", () => ({
  useMatch: () => ({ context: {} }),
}));

describe("useActiveWorkspace", () => {
  it("returns no workspace, and does not throw, when the slug did not resolve", () => {
    const { result } = renderHook(() => useActiveWorkspace());

    expect(result.current.data).toBeUndefined();
  });
});
