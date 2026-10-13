import { useLocation, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect } from "react";
import { useActiveWorkspace } from "@/workspace/queries/use-active-workspace";
import { canonicalWorkspaceHref } from "./lib/canonical-workspace-href";
import { toNavigation } from "@/onboarding";

/**
 * Keeps an open tab on the workspace's current slug. A rename elsewhere
 * refreshes the cached workspace; this moves the tab, without adding a
 * history entry for the old URL.
 */
export function useCanonicalWorkspaceUrl() {
  const { data: workspace } = useActiveWorkspace();
  const slug = useParams({
    strict: false,
    select: (params) => ("slug" in params ? String(params.slug) : undefined),
  });
  const location = useLocation({
    select: (l) => ({
      pathname: l.pathname,
      search: l.searchStr,
      hash: l.hash,
    }),
  });
  const navigate = useNavigate();

  useEffect(() => {
    if (!workspace || !slug) return;
    const canonical = canonicalWorkspaceHref(location, slug, workspace.slug);
    if (canonical)
      void navigate({ ...toNavigation(canonical), replace: true } as never);
  }, [workspace, slug, location, navigate]);
}
