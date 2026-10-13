import { describe, expect, it } from "vite-plus/test";
import { resolveSidebarTarget } from "./resolve-sidebar-target";

describe("resolveSidebarTarget", () => {
  it("resolves the symbolic workspace pages against the slug", () => {
    expect(resolveSidebarTarget("workspace-home", "acme")).toBe("/acme");
    expect(resolveSidebarTarget("workspace-settings", "acme")).toBe(
      "/acme/settings/account/information",
    );
  });

  it("passes other paths through", () => {
    expect(resolveSidebarTarget("/fake-feature", "acme")).toBe("/fake-feature");
  });
});
