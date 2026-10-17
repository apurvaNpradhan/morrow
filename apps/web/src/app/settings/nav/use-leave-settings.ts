import { useNavigate, useParams } from "@tanstack/react-router";
import { useCallback } from "react";
import { useGoBack } from "@/app/navigation/use-go-back";
import { useActiveWorkspace } from "@/workspace";

// Goes back to the page before Settings, or Home. Returns undefined until
// there is a workspace to go back to.
export function useLeaveSettings() {
  const navigate = useNavigate();
  const slug = useParams({
    from: "/_layout/_authenticated/$slug",
    select: (p) => p.slug,
  });
  const { data: workspace } = useActiveWorkspace();
  const goBack = useGoBack({ id: workspace?.id ?? "", slug });

  const leave = useCallback(() => {
    goBack(() => void navigate({ to: "/$slug", params: { slug } }));
  }, [goBack, navigate, slug]);

  return workspace ? leave : undefined;
}
