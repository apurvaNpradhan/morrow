import { workspaceUrl } from "@morrow/permissions/workspace-url";

/** Sidebar entries name workspace pages symbolically; everything else is a literal path. */
export function resolveSidebarTarget(to: string, slug: string): string {
  if (to === "workspace-home") return workspaceUrl(slug);
  if (to === "workspace-settings")
    return workspaceUrl(slug, "/settings/account/information");
  return to;
}
