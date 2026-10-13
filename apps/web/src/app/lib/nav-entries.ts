import { House, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavEntry = {
  id: string;
  titleKey: string;
  icon: LucideIcon;
  /** A symbolic workspace page (see resolve-sidebar-target) or a literal path. */
  to: string;
};

/** The web nav list. A vertical adds its sidebar entries here. */
export const navEntries: readonly NavEntry[] = [
  {
    id: "home",
    titleKey: "navigation:sidebar.home",
    icon: House,
    to: "workspace-home",
  },
  {
    id: "settings",
    titleKey: "navigation:userMenu.settings",
    icon: Settings,
    to: "workspace-settings",
  },
];
