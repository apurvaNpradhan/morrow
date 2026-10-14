import {
  createFileRoute,
  notFound,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { WorkspaceError, WorkspaceNotFound } from "@/workspace";
import {
  workspaceMemberCollection,
  workspaceMemberUserCollection,
} from "@/members";
import { PageTitle } from "@/design-system/page-title";
import { useCanonicalWorkspaceUrl } from "@/workspace";
import { useRememberLastWorkspace } from "@/workspace";
import { workspaceBySlugQueryOptions } from "@/workspace";
import { canonicalWorkspaceHref } from "@/workspace";
import { errorCode } from "@/app/lib/orpc-error";
import { toNavigation } from "@/onboarding";

export const Route = createFileRoute("/_layout/_authenticated/$slug")({
  beforeLoad: async ({ context, params, location }) => {
    let workspace;
    try {
      workspace = await context.queryClient.ensureQueryData(
        workspaceBySlugQueryOptions(params.slug),
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
  // Members sync before the page renders, so pages read them without waiting.
  // Hovering a link preloads this too, which starts the sync early.
  loader: async () => {
    await Promise.all([
      workspaceMemberCollection.preload(),
      workspaceMemberUserCollection.preload(),
    ]);
  },
  component: WorkspaceLayout,
  errorComponent: WorkspaceError,
  notFoundComponent: WorkspaceNotFound,
});

function WorkspaceLayout() {
  const { t } = useTranslation();
  const { workspace } = Route.useRouteContext();
  const { session, sessionError } = Route.useRouteContext();
  useCanonicalWorkspaceUrl();
  useRememberLastWorkspace(workspace.id, session, sessionError);

  return (
    <>
      <PageTitle
        title={t("workspace:home.pageTitle")}
        hideAppName={!workspace.name}
      />
      <Outlet />
    </>
  );
}
