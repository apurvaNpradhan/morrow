import { createFileRoute, redirect } from "@tanstack/react-router";
import { NoWorkspaceScreen } from "@/onboarding";
import { pendingInvitationsQueryOptions } from "@/members";
import { workspacesQueryOptions } from "@/workspace";
import { handleUnauthorized, isUnauthorizedError } from "@/app/lib/http-error";

// Sends the user to the workspace they last used, or the first one they belong to.
export const Route = createFileRoute("/_layout/_authenticated/")({
  beforeLoad: async ({ context }) => {
    const { queryClient, session } = context;
    let workspaces;
    try {
      // Both are needed by the screen below when there is no workspace; load
      // them together so it opens with its data.
      [workspaces] = await Promise.all([
        queryClient.fetchQuery({ ...workspacesQueryOptions, staleTime: 0 }),
        queryClient.prefetchQuery(
          pendingInvitationsQueryOptions(session?.user.email),
        ),
      ]);
    } catch (error) {
      if (isUnauthorizedError(error)) {
        handleUnauthorized();
        return;
      }
      throw error;
    }

    const lastUsedId = session?.session.activeOrganizationId;
    const target =
      workspaces.find((workspace) => workspace.id === lastUsedId) ??
      workspaces[0];
    if (target) {
      throw redirect({
        to: "/$slug",
        params: { slug: target.slug },
        replace: true,
      });
    }
  },
  component: NoWorkspaceScreen,
});
