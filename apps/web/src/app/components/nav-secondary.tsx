import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/design-system/ui/sidebar";
import { useActiveWorkspace } from "@/workspace";
import { resolveSidebarTarget } from "@/workspace";
import { navEntries } from "@/app/lib/nav-entries";

export function NavSecondary() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: workspace } = useActiveWorkspace();

  if (!workspace) return null;

  return (
    <>
      <SidebarMenu className="gap-0.5">
        {navEntries
          .filter((entry) => entry.id === "settings")
          .map((entry) => (
            <SidebarMenuItem key={entry.id}>
              <SidebarMenuButton
                size="default"
                className="h-8 text-sm"
                onClick={() =>
                  navigate({
                    to: resolveSidebarTarget(entry.to, workspace.slug),
                  })
                }
              >
                <entry.icon aria-hidden="true" />
                <span>{t(entry.titleKey)}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
      </SidebarMenu>
    </>
  );
}
