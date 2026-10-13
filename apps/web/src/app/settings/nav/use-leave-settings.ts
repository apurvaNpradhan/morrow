import { useNavigate, useParams } from "@tanstack/react-router";
import { useCallback } from "react";
import { useActiveWorkspace } from "@/workspace";

// Returns undefined until there is a workspace to go back to.
export function useLeaveSettings() {
  const navigate = useNavigate();
  const slug = useParams({
    from: "/_layout/_authenticated/$slug",
    select: (p) => p.slug,
  });
  const { data: workspace } = useActiveWorkspace();
  const canLeave = Boolean(workspace);

  const leave = useCallback(() => {
    navigate({ to: "/$slug", params: { slug } });
  }, [navigate, slug]);

  return canLeave ? leave : undefined;
}
