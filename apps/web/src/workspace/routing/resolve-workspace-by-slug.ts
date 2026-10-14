import { rpc } from "@/app/lib/orpc";
import { listMyWorkspaces } from "../queries/my-workspaces";

/**
 * The Workspace behind a URL slug, with the slug that was asked for. A current
 * slug is found in the synced Workspaces without a request. Anything else (a
 * former slug, or a Workspace the sync has not delivered yet) is asked of the
 * server, which answers "not found" for a Workspace the user cannot open.
 */
export async function resolveWorkspaceBySlug(userId: string, slug: string) {
  const mine = listMyWorkspaces(userId).find(
    (workspace) => workspace.slug === slug,
  );
  if (mine) return { ...mine, requestedSlug: slug };
  return rpc.workspace.resolve({ slug });
}
