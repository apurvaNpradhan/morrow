import { useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { projectCollection } from "@/projects";
import { getReturnLocation, usableReturnLocation } from "./return-location";

/**
 * Returns a function that goes back to the page before Settings or a full-page
 * task, or runs `fallback` when that page is gone or belongs to another
 * workspace.
 */
export function useGoBack(workspace: { id: string; slug: string }) {
  const navigate = useNavigate();
  const { id, slug } = workspace;
  return useCallback(
    (fallback: () => void) => {
      const projectKeys = new Set(
        projectCollection.toArray
          .filter((project) => project.workspaceId === id)
          .map((project) => project.key),
      );
      const target = usableReturnLocation(
        getReturnLocation(),
        slug,
        projectKeys,
      );
      if (target) void navigate({ href: target.pathname + target.search });
      else fallback();
    },
    [navigate, id, slug],
  );
}
