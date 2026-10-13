/** The one place workspace paths are built, for the web app and email links. */
export function workspaceUrl(slug: string, path = ""): string {
  const suffix = path && !path.startsWith("/") ? `/${path}` : path;
  return `/${slug}${suffix}`;
}
