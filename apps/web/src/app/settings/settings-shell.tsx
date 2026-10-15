import { useLocation } from "@tanstack/react-router";
import type { CSSProperties, ReactNode } from "react";
import { getSettingsBreadcrumb } from "./nav/get-settings-breadcrumb";
import { SettingsSidebar } from "./nav/settings-sidebar";
import { useLeaveSettings } from "./nav/use-leave-settings";
import { useLeaveSettingsOnEscape } from "./nav/use-leave-settings-on-escape";
import { useSettingsNav } from "./nav/use-settings-nav";
import { SettingsHeader } from "./settings-header";
import { SidebarInset, SidebarProvider } from "@/design-system/ui/sidebar";
import { useDevicePreferences } from "@/app/preferences/use-device-preferences";

type SettingsShellProps = {
  children: ReactNode;
};

// Settings swap the app sidebar for their own, but keep the app's frame
// (sidebar width, inset panel, header height) so moving between the two
// doesn't shift anything on screen.
export function SettingsShell({ children }: SettingsShellProps) {
  const { sidebarDefaultOpen } = useDevicePreferences();
  const nav = useSettingsNav();
  const pathname = useLocation({ select: (location) => location.pathname });
  const leave = useLeaveSettings();

  useLeaveSettingsOnEscape(leave);

  return (
    <div className="flex w-full bg-background">
      <SidebarProvider
        defaultOpen={sidebarDefaultOpen}
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 60)",
          } as CSSProperties
        }
      >
        <SettingsSidebar nav={nav} onLeave={leave} />
        <SidebarInset className="m-2 flex flex-1 flex-col overflow-hidden rounded-xl border border-border/80 bg-background shadow-sm/5">
          <SettingsHeader breadcrumb={getSettingsBreadcrumb(nav, pathname)} />
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
