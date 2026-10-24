import type React from "react";
import type { ReactNode } from "react";
import { AppSidebar } from "./app-sidebar";
import { SidebarInset, SidebarProvider } from "@/design-system/ui/sidebar";
import { useUserPreferencesEffects } from "@/app/hooks/use-user-preferences-effects";
import { cn } from "@/design-system/cn";
import { useDevicePreferences } from "@/app/preferences/use-device-preferences";

type LayoutProps = {
  children: ReactNode;
  className?: string;
};

type HeaderProps = {
  children: ReactNode;
  className?: string;
};

type ContentProps = {
  children: ReactNode;
  className?: string;
};

function LayoutHeader({ children, className }: HeaderProps) {
  return (
    <header
      className={cn(
        "flex h-10 shrink-0 gap-2 transition-[width,height] ease-in-out group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-8 border-b border-border bg-card p-2",
        className,
      )}
    >
      {children}
    </header>
  );
}

function LayoutContent({ children, className }: ContentProps) {
  return (
    <div className={cn("flex-1 min-h-0", className)}>
      <div className="h-full">{children}</div>
    </div>
  );
}

export function Layout({ children, className }: LayoutProps) {
  const { sidebarDefaultOpen } = useDevicePreferences();

  useUserPreferencesEffects();

  return (
    <div className="flex w-full bg-background">
      <SidebarProvider
        defaultOpen={sidebarDefaultOpen}
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 60)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as React.CSSProperties
        }
      >
        <AppSidebar />
        <SidebarInset
          className={cn(
            "m-2 max-md:m-0 max-md:rounded-none max-md:border-0 flex flex-1 flex-col overflow-auto rounded-xl border border-border/80 bg-background shadow-sm/5",
            className,
          )}
        >
          {children}
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}

Layout.Header = LayoutHeader;
Layout.Content = LayoutContent;
