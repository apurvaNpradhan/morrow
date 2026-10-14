import { useParams } from "@tanstack/react-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { buildSettingsNav } from "./build-settings-nav";
import { useAdminAccess } from "@/admin";
import { useNavProjects } from "@/projects";
import { useActiveWorkspace } from "@/workspace";

export function useSettingsNav() {
  const { t } = useTranslation();
  const slug = useParams({
    from: "/_layout/_authenticated/$slug",
    select: (p) => p.slug,
  });
  const { data: workspace } = useActiveWorkspace();
  const { data: hasAdminAccess } = useAdminAccess();
  const projects = useNavProjects(workspace?.id);

  return useMemo(
    () =>
      buildSettingsNav({
        t,
        slug,
        workspaceName: workspace?.name,
        hasAdminAccess: Boolean(hasAdminAccess),
        projects,
      }),
    [t, slug, workspace?.name, hasAdminAccess, projects],
  );
}
