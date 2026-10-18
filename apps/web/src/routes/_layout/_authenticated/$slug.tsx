import {
  createFileRoute,
  notFound,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import { WorkspaceError, WorkspaceNotFound } from "@/workspace";
import {
  workspaceInvitationCollection,
  workspaceMemberUserCollection,
} from "@/members";
import { labelCollection } from "@/labels";
import { projectCollection, projectColumnCollection } from "@/projects";
import { useCanonicalWorkspaceUrl } from "@/workspace";
import { useRememberLastWorkspace } from "@/workspace";
import { resolveWorkspaceBySlug, useActiveWorkspace } from "@/workspace";
import { canonicalWorkspaceHref } from "@/workspace";
import { errorCode } from "@/app/lib/orpc-error";
import { toNavigation } from "@/onboarding";
import { TicketWorkspaceProvider } from "@/tasks";

export const Route = createFileRoute("/_layout/_authenticated/$slug")({
  beforeLoad: async ({ context, params, location }) => {
    let workspace;
    try {
      workspace = await resolveWorkspaceBySlug(
        context.session?.user.id ?? "",
        params.slug,
      );
    } catch (error) {
      // Not a member and no such slug look the same on purpose.
      if (errorCode(error) === "NOT_FOUND") throw notFound();
      throw error;
    }

    // A former slug moves to the canonical URL without a history entry.
    const canonical = canonicalWorkspaceHref(
      {
        pathname: location.pathname,
        search: location.searchStr,
        hash: location.hash,
      },
      params.slug,
      workspace.slug,
    );
    if (canonical) {
      throw redirect({ ...toNavigation(canonical), replace: true } as never);
    }
    return { workspace };
  },
  // Members, invitations, projects and labels sync before the page renders, so pages
  // read them without waiting. Hovering a link preloads this too, which starts the sync
  // early. (Workspaces and my own members come from the layout above.)
  loader: async () => {
    await Promise.all([
      workspaceMemberUserCollection.preload(),
      workspaceInvitationCollection.preload(),
      projectCollection.preload(),
      projectColumnCollection.preload(),
      labelCollection.preload(),
    ]);
  },
  component: WorkspaceLayout,
  errorComponent: WorkspaceError,
  notFoundComponent: WorkspaceNotFound,
});

function WorkspaceLayout() {
  const {
    workspace: resolved,
    session,
    sessionError,
  } = Route.useRouteContext();
  const { data: live } = useActiveWorkspace();
  const workspace = live ?? resolved;
  useCanonicalWorkspaceUrl();
  useRememberLastWorkspace(workspace.id, session, sessionError);

  return (
    <TicketWorkspaceProvider id={workspace.id} slug={workspace.slug}>
      <Outlet />
    </TicketWorkspaceProvider>
  );
}
