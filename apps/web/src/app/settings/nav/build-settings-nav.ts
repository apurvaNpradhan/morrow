import { workspaceUrl } from "@morrow/permissions/workspace-url";
import {
  Building2,
  Server,
  Settings,
  Shield,
  SlidersHorizontal,
  User,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SettingsNav } from "./types";

type Translate = (key: string) => string;

/** What a project contributes to the navigation. */
export type SettingsNavProject = {
  key: string;
  name: string;
  icon: LucideIcon;
  iconClassName?: string;
};

type BuildSettingsNavInput = {
  t: Translate;
  /** The URL slug of the workspace whose settings these are. */
  slug: string;
  workspaceName?: string;
  hasAdminAccess: boolean;
  /** The workspace's active projects, in order. */
  projects?: SettingsNavProject[];
};

export function buildSettingsNav({
  t,
  slug,
  workspaceName,
  hasAdminAccess,
  projects = [],
}: BuildSettingsNavInput): SettingsNav {
  return {
    account: {
      id: "account",
      label: t("settings:account"),
      links: [
        {
          id: "information",
          label: t("settings:information"),
          to: workspaceUrl(slug, "/settings/account/information"),
          icon: User,
        },
        {
          id: "preferences",
          label: t("settings:preferences"),
          to: workspaceUrl(slug, "/settings/account/preferences"),
          icon: SlidersHorizontal,
        },
      ],
    },
    workspace: {
      id: "workspace",
      label: workspaceName || t("navigation:page.settingsWorkspaceTab"),
      links: [
        {
          id: "workspace-general",
          label: t("settings:workspaceGeneral.title"),
          to: workspaceUrl(slug, "/settings/workspace/general"),
          icon: Settings,
        },
        {
          id: "workspace-members",
          label: t("team:members.pageTitle"),
          to: workspaceUrl(slug, "/settings/workspace/members"),
          icon: Users,
        },
        {
          id: "workspace-roles",
          label: t("settings:workspaceRoles.title"),
          to: workspaceUrl(slug, "/settings/workspace/roles"),
          icon: Shield,
        },
      ],
    },
    projects:
      projects.length > 0
        ? {
            id: "projects",
            label: t("settings:projects"),
            links: projects.map((project) => ({
              id: `project-${project.key}`,
              label: project.name,
              to: workspaceUrl(
                slug,
                `/settings/projects/${project.key}/general`,
              ),
              matchPrefix: workspaceUrl(
                slug,
                `/settings/projects/${project.key}`,
              ),
              icon: project.icon,
              iconClassName: project.iconClassName,
            })),
          }
        : null,
    admin: hasAdminAccess
      ? {
          id: "admin",
          label: t("settings:administration"),
          links: [
            {
              id: "admin-users",
              label: t("settings:adminUsers.title"),
              to: workspaceUrl(slug, "/settings/admin/users"),
              icon: Server,
            },
            {
              id: "admin-workspaces",
              label: t("settings:adminWorkspaces.title"),
              to: workspaceUrl(slug, "/settings/admin/workspaces"),
              icon: Building2,
            },
          ],
        }
      : null,
  };
}
