import { describe, expect, it } from "vite-plus/test";
import type { McpClient } from "#api/platform/orpc/mcp-tool";
import { resolveScope } from "./resolve-scope";

const client = {
  workspace: { list: async () => [{ id: "ws1", slug: "atlas" }] },
  projects: { list: async () => [{ id: "p1", key: "MOR" }] },
} as unknown as McpClient;

describe("resolveScope", () => {
  it("accepts a workspace slug", async () => {
    expect(
      await resolveScope(client, { workspaceId: "atlas", projectId: "p1" }),
    ).toEqual({ workspaceId: "ws1", projectId: "p1" });
  });

  it("fills a missing projectId from the ticket key", async () => {
    expect(
      await resolveScope(client, { workspaceId: "atlas", ticketId: "mor-23" }),
    ).toEqual({ workspaceId: "ws1", ticketId: "mor-23", projectId: "p1" });
  });

  it("refuses an unknown project key", async () => {
    await expect(
      resolveScope(client, { workspaceId: "ws1", ticketId: "ZZZ-1" }),
    ).rejects.toThrow("No project with key ZZZ in atlas. Keys: MOR");
  });

  it("refuses an unknown workspace and a malformed ticket id", async () => {
    await expect(resolveScope(client, { workspaceId: "nope" })).rejects.toThrow(
      'No workspace "nope". Workspaces: atlas',
    );
    await expect(
      resolveScope(client, { workspaceId: "atlas", ticketId: "23" }),
    ).rejects.toThrow("not a ticket id");
  });
});
