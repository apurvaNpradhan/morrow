import type { LucideIcon } from "lucide-react";
import type { CSSProperties } from "react";

export type SettingsNavSubLink = {
  id: string;
  label: string;
  to: string;
};

export type SettingsNavLink = SettingsNavSubLink & {
  icon: LucideIcon;
  iconStyle?: CSSProperties;
  /** A path whose pages all belong to this link, e.g. a project's General and Workflow pages. */
  matchPrefix?: string;
};

export type SettingsNavGroup = {
  id: string;
  label: string;
  links: SettingsNavLink[];
};

export type SettingsNav = {
  account: SettingsNavGroup;
  workspace: SettingsNavGroup;
  /** The workspace's active projects, or null when it has none. */
  projects: SettingsNavGroup | null;
  admin: SettingsNavGroup | null;
};
