import { WORKSPACE_BY_SLUG_KEY } from "@/workspace/routing/workspace-by-slug-query";

const WORKSPACE_PATH = /^\/([^/]+)/;

/** The id of the workspace a `/<slug>` pathname refers to, once that slug has been resolved. */
export function getRouteWorkspaceId(
  queryClient: { getQueryData: (key: readonly unknown[]) => unknown },
  pathname: string,
): string | undefined {
  const slug = pathname.match(WORKSPACE_PATH)?.[1];
  if (!slug) return undefined;
  const workspace = queryClient.getQueryData([...WORKSPACE_BY_SLUG_KEY, slug]);
  return (workspace as { id?: string } | undefined)?.id;
}
