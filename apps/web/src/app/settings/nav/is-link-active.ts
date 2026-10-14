import type { SettingsNavLink } from "./types";

/** Whether a settings link is the page at `pathname` (trailing slashes already removed). */
export function isSettingsLinkActive(link: SettingsNavLink, pathname: string) {
  if (pathname === link.to) return true;
  const prefix = link.matchPrefix;
  return (
    prefix !== undefined &&
    (pathname === prefix || pathname.startsWith(`${prefix}/`))
  );
}
