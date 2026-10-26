import type * as React from "react";

import { NavMain } from "./nav-main";
import { NavSecondary } from "./nav-secondary";
import { ThemeToggleDropdown } from "./theme-toggle-dropdown";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/design-system/ui/sidebar";
import { VersionDisplay } from "./version-display";
import { SidebarDocuments } from "@/documents";
import { SidebarProjects } from "@/projects";
import { SearchButton } from "@/search";
import { useActiveWorkspace, WorkspaceSwitcher } from "@/workspace";
import { useRegisterSidebarToggle } from "@/app/commands";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { toggleSidebar } = useSidebar();
  const { data: workspace } = useActiveWorkspace();

  useRegisterSidebarToggle(toggleSidebar);

  return (
    <Sidebar
      collapsible="offcanvas"
      variant="inset"
      className="border-none"
      {...props}
    >
      <SidebarHeader className="pt-1 pb-1.5">
        <WorkspaceSwitcher>
          <SearchButton />
        </WorkspaceSwitcher>
      </SidebarHeader>
      <SidebarContent className="gap-1 overflow-y-auto py-1">
        <NavMain />
        {workspace ? <SidebarProjects workspace={workspace} /> : null}
        {workspace ? <SidebarDocuments workspace={workspace} /> : null}
      </SidebarContent>
      <SidebarFooter>
        <NavSecondary />
        <div className="flex items-center justify-between">
          <VersionDisplay />
          <ThemeToggleDropdown />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
