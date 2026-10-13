import { workspaceUrl } from "@morrow/permissions/workspace-url";

/**
 * Rewrites the `/<requested>` prefix of a location to the workspace's
 * canonical slug, keeping the rest of the path, search and hash. Returns null
 * when the location already uses the canonical slug.
 */
export function canonicalWorkspaceHref(
  location: { pathname: string; search?: string; hash?: string },
  requestedSlug: string,
  canonicalSlug: string,
): string | null {
  if (requestedSlug === canonicalSlug) return null;
  const prefix = workspaceUrl(requestedSlug);
  if (
    location.pathname !== prefix &&
    !location.pathname.startsWith(`${prefix}/`)
  )
    return null;
  const rest = location.pathname.slice(prefix.length);
  return `${workspaceUrl(canonicalSlug)}${rest}${location.search ?? ""}${location.hash ?? ""}`;
}
