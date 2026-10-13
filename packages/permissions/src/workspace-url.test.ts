import { describe, expect, it } from "vite-plus/test";
import { workspaceUrl } from "./workspace-url";

describe("workspaceUrl", () => {
  it("builds the workspace root", () => {
    expect(workspaceUrl("acme")).toBe("/acme");
  });

  it("appends a path with or without a leading slash", () => {
    expect(workspaceUrl("acme", "/settings/account")).toBe(
      "/acme/settings/account",
    );
    expect(workspaceUrl("acme", "inbox")).toBe("/acme/inbox");
  });
});
