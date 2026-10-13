import { describe, expect, it } from "vite-plus/test";
import { getRouteWorkspaceId } from "./get-route-workspace-id";

const client = (known: Record<string, string>) => ({
  getQueryData: (key: readonly unknown[]) => {
    const id = known[String(key[2])];
    return id ? { id } : undefined;
  },
});

describe("getRouteWorkspaceId", () => {
  it("reads the workspace id for the slug in the pathname", () => {
    expect(
      getRouteWorkspaceId(
        client({ acme: "ws-1" }),
        "/acme/settings/workspace/general",
      ),
    ).toBe("ws-1");
  });

  it("is undefined outside a workspace or before the slug resolves", () => {
    expect(getRouteWorkspaceId(client({}), "/acme")).toBeUndefined();
    expect(
      getRouteWorkspaceId(client({ acme: "ws-1" }), "/onboarding/you"),
    ).toBeUndefined();
  });
});
