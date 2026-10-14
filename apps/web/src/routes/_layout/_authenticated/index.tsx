import { createFileRoute, redirect } from "@tanstack/react-router";
import { NoWorkspaceScreen } from "@/onboarding";
import { listMyWorkspaces } from "@/workspace";

// Sends the user to the workspace they last used, or the first one they belong to.
export const Route = createFileRoute("/_layout/_authenticated/")({
  beforeLoad: ({ context }) => {
    const { session } = context;
    // Synced by the layout above, so this is a read, not a request.
    const workspaces = listMyWorkspaces(session?.user.id ?? "");

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
