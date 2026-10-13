import { describe, expect, it } from "vite-plus/test";
import { buildSettingsNav } from "./build-settings-nav";

const t = (key: string) => key;

function build(
  overrides: Partial<Parameters<typeof buildSettingsNav>[0]> = {},
) {
  return buildSettingsNav({
    t,
    slug: "acme",
    workspaceName: "Acme",
    hasAdminAccess: false,
    ...overrides,
  });
}

describe("buildSettingsNav", () => {
  it("labels the workspace group with the workspace name", () => {
    expect(build().workspace.label).toBe("Acme");
    expect(build({ workspaceName: undefined }).workspace.label).toBe(
      "navigation:page.settingsWorkspaceTab",
    );
  });

  it("only shows administration to instance admins", () => {
    expect(build().admin).toBeNull();
    expect(
      build({ hasAdminAccess: true }).admin?.links.map((link) => link.to),
    ).toEqual([
      "/acme/settings/admin/users",
      "/acme/settings/admin/workspaces",
    ]);
  });

  it("scopes every link to the workspace in the URL", () => {
    const nav = build({ slug: "other", hasAdminAccess: true });
    const links = [nav.account, nav.workspace, nav.admin].flatMap(
      (group) => group?.links ?? [],
    );
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) expect(link.to).toMatch(/^\/other\/settings\//);
  });
});
