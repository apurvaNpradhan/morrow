import { useNavigate, useParams } from "@tanstack/react-router";
import { useCallback } from "react";
import {
  getReturnLocation,
  usableReturnLocation,
} from "@/app/navigation/return-location";
import { projectCollection } from "@/projects";
import { useActiveWorkspace } from "@/workspace";

// Goes back to the page before Settings, or Home. Returns undefined until there is a workspace to go back to.
export function useLeaveSettings() {
  const navigate = useNavigate();
  const slug = useParams({
    from: "/_layout/_authenticated/$slug",
    select: (p) => p.slug,
  });
  const { data: workspace } = useActiveWorkspace();
  const canLeave = Boolean(workspace);

  const leave = useCallback(() => {
    const projectKeys = new Set(
      projectCollection.toArray
        .filter((project) => project.workspaceId === workspace?.id)
        .map((project) => project.key),
    );
    const target = usableReturnLocation(getReturnLocation(), slug, projectKeys);
    if (target) navigate({ href: target.pathname + target.search });
    else navigate({ to: "/$slug", params: { slug } });
  }, [navigate, slug, workspace?.id]);

  return canLeave ? leave : undefined;
}
