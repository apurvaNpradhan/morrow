import { useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAdminAccess } from "@/admin";
import { setTheme } from "@/app/preferences/set-theme";
import { useSignOut } from "@/auth";
import { useActiveWorkspace, useWorkspacePermission } from "@/workspace";
import type { HotkeyId } from "./hotkeys";
import { openOverlay, useHasOverlayHost } from "./overlay-store";
import { useSidebarToggle } from "./sidebar-toggle";

export type CommandGroup = "navigate" | "create" | "view" | "account";

export type Command = {
  id: string;
  group: CommandGroup;
  label: string;
  /** Present when a hotkey runs this command. */
  hotkey?: HotkeyId;
  run: () => void;
};

/** The commands the user can run right now: unavailable ones are absent, so their hotkeys are inert too. */
export function useCommands(): Command[] {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: workspace } = useActiveWorkspace();
  const permission = useWorkspacePermission();
  const { data: isInstanceAdmin } = useAdminAccess();
  const { mutate: signOut } = useSignOut();
  const toggleSidebar = useSidebarToggle();
  const hasSwitcher = useHasOverlayHost("workspaceSwitcher");

  const slug = workspace?.slug;
  const canCreateProjects = permission.canCreateProjects();
  const canInvite = permission.canInviteUsers();
  const canManageRoles = permission.canManageRoles();

  return useMemo(() => {
    type Entry = Omit<Command, "label">;
    const go = (to: string) => () => {
      if (slug) void navigate({ to, params: { slug } } as never);
    };

    const entries: Entry[] = [];
    if (slug) {
      entries.push(
        {
          id: "goHome",
          group: "navigate",
          hotkey: "goHome",
          run: go("/$slug"),
        },
        {
          id: "goProjects",
          group: "navigate",
          hotkey: "goProjects",
          run: go("/$slug/projects"),
        },
        {
          id: "goMembers",
          group: "navigate",
          hotkey: "goMembers",
          run: go("/$slug/members"),
        },
        {
          id: "goSettings",
          group: "navigate",
          hotkey: "goSettings",
          run: go("/$slug/settings/workspace/general"),
        },
        {
          id: "goAccount",
          group: "navigate",
          hotkey: "goAccount",
          run: go("/$slug/settings/account/information"),
        },
      );
      if (canManageRoles) {
        entries.push({
          id: "goRoles",
          group: "navigate",
          run: go("/$slug/settings/workspace/roles"),
        });
      }
      if (isInstanceAdmin) {
        entries.push(
          {
            id: "adminUsers",
            group: "navigate",
            run: go("/$slug/settings/admin/users"),
          },
          {
            id: "adminWorkspaces",
            group: "navigate",
            run: go("/$slug/settings/admin/workspaces"),
          },
        );
      }
      if (hasSwitcher) {
        entries.push({
          id: "switchWorkspace",
          group: "navigate",
          hotkey: "switchWorkspace",
          run: () => openOverlay("workspaceSwitcher"),
        });
      }
      if (canCreateProjects) {
        entries.push({
          id: "createProject",
          group: "create",
          hotkey: "createProject",
          run: () => openOverlay("createProject"),
        });
      }
    }
    entries.push({
      id: "createWorkspace",
      group: "create",
      hotkey: "createWorkspace",
      run: () => openOverlay("createWorkspace"),
    });
    if (slug && canInvite) {
      entries.push({
        id: "inviteMember",
        group: "create",
        run: () => openOverlay("inviteMember"),
      });
    }
    if (toggleSidebar) {
      entries.push({
        id: "toggleSidebar",
        group: "view",
        hotkey: "toggleSidebar",
        run: toggleSidebar,
      });
    }
    entries.push(
      { id: "themeLight", group: "view", run: () => setTheme("light") },
      { id: "themeDark", group: "view", run: () => setTheme("dark") },
      { id: "themeSystem", group: "view", run: () => setTheme("system") },
      {
        id: "help",
        group: "view",
        hotkey: "help",
        run: () => openOverlay("help"),
      },
      { id: "signOut", group: "account", run: () => signOut() },
    );

    return entries.map((entry) => ({
      ...entry,
      label: t(`navigation:commands.${entry.id}`),
    }));
  }, [
    slug,
    navigate,
    canCreateProjects,
    canInvite,
    canManageRoles,
    isInstanceAdmin,
    toggleSidebar,
    hasSwitcher,
    signOut,
    t,
  ]);
}
