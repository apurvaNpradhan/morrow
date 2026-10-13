import { useLocation, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/design-system/ui/sidebar";
import { useActiveWorkspace } from "@/workspace";
import { resolveSidebarTarget } from "@/workspace";
import { navEntries } from "@/app/lib/nav-entries";

export function NavMain() {
  const { t } = useTranslation();
  const { data: workspace } = useActiveWorkspace();
  const navigate = useNavigate();
  const pathname = useLocation({
    select: (location) => location.pathname.replace(/\/+$/, ""),
  });

  if (!workspace) return null;

  const navItems = navEntries
    .filter((entry) => entry.id !== "settings")
    .map((entry) => ({
      ...entry,
      title: t(entry.titleKey),
      url: resolveSidebarTarget(entry.to, workspace.slug),
    }));

  return (
    <SidebarGroup className="gap-1 p-2">
      <SidebarGroupContent>
        <SidebarMenu className="gap-0.5">
          {navItems.map((item) => (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton
                tooltip={item.title}
                isActive={pathname === item.url}
                size="default"
                className="h-8 text-sm"
                onClick={() => navigate({ to: item.url })}
              >
                <item.icon aria-hidden="true" />
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
