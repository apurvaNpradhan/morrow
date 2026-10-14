import { describe, expect, it } from "vite-plus/test";
import { User } from "lucide-react";
import { buildSettingsNav } from "./build-settings-nav";
import { isSettingsLinkActive } from "./is-link-active";

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

  it("lists the active projects, each opening its general settings", () => {
    expect(build().projects).toBeNull();

    const nav = build({
      projects: [
        { key: "MOR", name: "Morrow", icon: User },
        { key: "WEB", name: "Website", icon: User },
      ],
    });

    expect(nav.projects?.label).toBe("settings:projects");
    expect(nav.projects?.links.map((link) => [link.label, link.to])).toEqual([
      ["Morrow", "/acme/settings/projects/MOR/general"],
      ["Website", "/acme/settings/projects/WEB/general"],
    ]);
  });

  it("keeps a project's link active on all of its settings pages", () => {
    const [link] = build({
      projects: [{ key: "MOR", name: "Morrow", icon: User }],
    }).projects!.links;

    for (const path of [
      "/acme/settings/projects/MOR/general",
      "/acme/settings/projects/MOR/workflow",
    ]) {
      expect(isSettingsLinkActive(link!, path)).toBe(true);
    }
    expect(
      isSettingsLinkActive(link!, "/acme/settings/projects/MORE/general"),
    ).toBe(false);
    expect(
      isSettingsLinkActive(link!, "/acme/settings/workspace/general"),
    ).toBe(false);
  });
});
