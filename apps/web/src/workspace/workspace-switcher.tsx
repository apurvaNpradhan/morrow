import { useNavigate } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/design-system/ui/menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/design-system/ui/sidebar";
import { UserAvatar } from "@/design-system/user-avatar";
import { useActiveWorkspace } from "./queries/use-active-workspace";
import { useMyWorkspaces } from "./queries/use-my-workspaces";
import { formatForDisplay } from "@tanstack/react-hotkeys";
import {
  closeOverlay,
  openOverlay,
  useIsOverlayOpen,
  useRegisterOverlayHost,
} from "@/app/commands";
import type { WorkspaceSummary } from "./types";
import { WorkspaceLogo } from "./logo/workspace-logo";

export function WorkspaceSwitcher() {
  const { t } = useTranslation();
  const { data: workspace } = useActiveWorkspace();

  const workspaces = useMyWorkspaces();
  const navigate = useNavigate();
  useRegisterOverlayHost("workspaceSwitcher");
  const isOpen = useIsOverlayOpen("workspaceSwitcher");
  const setIsOpen = React.useCallback((open: boolean) => {
    if (open) openOverlay("workspaceSwitcher");
    else closeOverlay("workspaceSwitcher");
  }, []);

  // The workspace route records itself as the last used one, so switching is
  // only navigation and cannot fail halfway.
  const handleWorkspaceChange = React.useCallback(
    (selectedWorkspace: WorkspaceSummary) => {
      void navigate({ to: "/$slug", params: { slug: selectedWorkspace.slug } });
    },
    [navigate],
  );

  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!workspaces || workspaces.length === 0) return;

      if (
        (event.metaKey || event.ctrlKey) &&
        event.key >= "1" &&
        event.key <= "9"
      ) {
        event.preventDefault();
        const index = Number.parseInt(event.key, 10) - 1;
        if (index < workspaces.length) {
          handleWorkspaceChange(workspaces[index]);
          setIsOpen(false);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, workspaces, handleWorkspaceChange, setIsOpen]);

  if (!workspace) {
    return null;
  }

  return (
    <>
      <div className="flex items-center justify-between w-full gap-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    className="group h-8 w-full rounded-md px-2 text-sidebar-foreground data-[active=true]:bg-sidebar-accent/50"
                    size="default"
                  />
                }
              >
                <div className="flex items-center gap-2 min-w-0 w-full">
                  <WorkspaceLogo
                    name={workspace.name}
                    logo={workspace.logo}
                    className="size-5"
                  />
                  <span className="truncate text-sm font-medium text-foreground">
                    {workspace.name}
                  </span>
                </div>
                <ChevronDown
                  className={`ml-1 size-3.5 text-foreground/70 opacity-90 group-hover:opacity-100 data-[state=open]:opacity-100 data-[state=open]:rotate-180 transition-[rotate,opacity] duration-200 ease-out`}
                  data-state={isOpen ? "open" : "closed"}
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="min-w-(--anchor-width) text-sidebar-foreground"
                align="start"
                side="bottom"
                sideOffset={4}
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel>
                    {t("navigation:workspaceSwitcher.workspaces")}
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />

                {workspaces?.map((ws: WorkspaceSummary, index: number) => (
                  <DropdownMenuItem
                    key={ws.id}
                    onClick={() => {
                      if (ws.id !== workspace.id) {
                        handleWorkspaceChange(ws);
                        setIsOpen(false);
                      }
                    }}
                    disabled={ws.id === workspace.id}
                    className="h-7 text-sm data-highlighted:bg-sidebar-accent data-highlighted:text-sidebar-accent-foreground"
                  >
                    <WorkspaceLogo
                      name={ws.name}
                      logo={ws.logo}
                      className="size-4 text-[8px]"
                    />
                    <span className="flex-1 text-left">{ws.name}</span>
                    <DropdownMenuShortcut>
                      {formatForDisplay(`Mod+${index > 8 ? 0 : index + 1}`)}
                    </DropdownMenuShortcut>
                  </DropdownMenuItem>
                ))}

                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    openOverlay("createWorkspace");
                  }}
                  className="h-7 text-sm data-highlighted:bg-sidebar-accent data-highlighted:text-sidebar-accent-foreground"
                >
                  <span>{t("navigation:workspaceSwitcher.addWorkspace")}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>

        <div className="flex items-center gap-0.5">
          <div className="h-8 w-8 shrink-0">
            <UserAvatar />
          </div>
        </div>
      </div>
    </>
  );
}
