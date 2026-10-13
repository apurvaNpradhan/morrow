import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { workspaceBySlugQueryOptions } from "@/workspace/routing/workspace-by-slug-query";

/** The workspace named by the `/$slug` URL, not the session's last-used one. */
export function useActiveWorkspace() {
  const slug = useParams({
    strict: false,
    select: (params) =>
      "slug" in params && typeof params.slug === "string"
        ? params.slug
        : undefined,
  });
  const { data, error, isPending } = useQuery({
    ...workspaceBySlugQueryOptions(slug ?? ""),
    enabled: !!slug,
  });

  return {
    data,
    error,
    isLoading: !!slug && isPending,
    isError: !!error,
  };
}
