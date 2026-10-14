import { Link } from "@tanstack/react-router";
import { isSettingsLinkActive } from "./is-link-active";
import type { SettingsNavGroup as SettingsNavGroupModel } from "./types";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/design-system/ui/sidebar";

type SettingsNavGroupProps = {
  group: SettingsNavGroupModel;
  pathname: string;
};

export function SettingsNavGroup({ group, pathname }: SettingsNavGroupProps) {
  return (
    <SidebarGroup className="gap-0.5 px-2 py-1.5">
      <SidebarGroupLabel className="h-7 truncate text-sidebar-foreground/70">
        {group.label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="gap-0.5">
          {group.links.map((link) => (
            <SidebarMenuItem key={link.id}>
              <SidebarMenuButton
                isActive={isSettingsLinkActive(link, pathname)}
                className="h-8 text-sm"
                render={<Link to={link.to} />}
              >
                <link.icon aria-hidden="true" />
                <span>{link.label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
