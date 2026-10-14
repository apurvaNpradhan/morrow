import { describe, expect, it } from "vite-plus/test";
import { User } from "lucide-react";
import { buildSettingsNav } from "./build-settings-nav";
import { getSettingsBreadcrumb } from "./get-settings-breadcrumb";

const nav = buildSettingsNav({
  t: (key) => key,
  slug: "acme",
  workspaceName: "Acme",
  hasAdminAccess: true,
  projects: [{ key: "MOR", name: "Morrow", icon: User }],
});

describe("getSettingsBreadcrumb", () => {
  it("names the group and page for account and workspace pages", () => {
    expect(
      getSettingsBreadcrumb(nav, "/acme/settings/account/preferences"),
    ).toEqual({ section: "settings:account", page: "settings:preferences" });
    expect(
      getSettingsBreadcrumb(nav, "/acme/settings/workspace/general/"),
    ).toEqual({ section: "Acme", page: "settings:workspaceGeneral.title" });
  });

  it("names the project for both of its settings pages", () => {
    for (const page of ["general", "workflow"]) {
      expect(
        getSettingsBreadcrumb(nav, `/acme/settings/projects/MOR/${page}`),
      ).toEqual({ section: "settings:projects", page: "Morrow" });
    }
  });

  it("returns null for paths outside the settings navigation", () => {
    expect(getSettingsBreadcrumb(nav, "/acme/settings/unknown")).toBe(null);
  });
});
