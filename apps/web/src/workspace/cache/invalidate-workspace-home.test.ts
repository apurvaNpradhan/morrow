import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vite-plus/test";
import { invalidateWorkspaceHomeQueries } from "./invalidate-workspace-home";

describe("invalidateWorkspaceHomeQueries", () => {
  it("marks only the signaled workspace's retained home queries stale", () => {
    const client = new QueryClient();
    const workspaceId = "workspace-1";
    const otherWorkspaceId = "workspace-2";
    const affectedKeys = [
      ["workspace", "full", workspaceId],
      [["activity", "list"], { input: { workspaceId } }],
    ];
    for (const queryKey of affectedKeys) client.setQueryData(queryKey, {});
    client.setQueryData(["workspace-roles", otherWorkspaceId], {});

    invalidateWorkspaceHomeQueries(client, workspaceId);

    for (const queryKey of affectedKeys) {
      expect(client.getQueryState(queryKey)?.isInvalidated).toBe(true);
    }
    expect(
      client.getQueryState(["workspace-roles", otherWorkspaceId])
        ?.isInvalidated,
    ).toBe(false);
  });
});
