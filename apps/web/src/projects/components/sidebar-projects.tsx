import { FolderKanban, Plus } from "lucide-react";
import { Link, useLocation } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/design-system/ui/sidebar";
import { useWorkspacePermission } from "@/workspace";
import { useProjectsOutsidePages } from "../queries/use-projects";
import { CreateProjectDialog } from "./create-project-dialog";
import { ProjectIcon } from "./project-icon";

/** The active projects of the current workspace, in the shared order. */
export function SidebarProjects({
  workspace,
}: {
  workspace: { id: string; slug: string };
}) {
  const { t } = useTranslation("projects");
  const { canCreateProjects } = useWorkspacePermission();
  const pathname = useLocation({
    select: (location) => location.pathname.replace(/\/+$/, ""),
  });
  const [creating, setCreating] = useState(false);
  const projects = useProjectsOutsidePages(workspace.id).filter(
    (project) => !project.archivedAt,
  );
  const listPath = `/${workspace.slug}/projects`;

  return (
    <SidebarGroup className="gap-1 p-2">
      <SidebarGroupLabel>{t("sidebar.title")}</SidebarGroupLabel>
      {canCreateProjects() ? (
        <SidebarGroupAction
          aria-label={t("sidebar.create")}
          title={t("sidebar.create")}
          onClick={() => setCreating(true)}
        >
          <Plus aria-hidden="true" />
        </SidebarGroupAction>
      ) : null}
      <SidebarGroupContent>
        <SidebarMenu className="gap-0.5">
          {projects.map((project) => {
            const path = `${listPath}/${project.key}`;
            return (
              <SidebarMenuItem key={project.id}>
                <SidebarMenuButton
                  className="h-8 text-sm"
                  tooltip={project.name}
                  isActive={pathname === path}
                  render={
                    <Link
                      to="/$slug/projects/$key"
                      params={{ slug: workspace.slug, key: project.key }}
                    />
                  }
                >
                  <ProjectIcon project={project} />
                  <span className="truncate">{project.name}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
          {projects.length === 0 ? (
            <li className="px-2 py-1 text-xs text-muted-foreground">
              {t("sidebar.empty")}
            </li>
          ) : null}
          <SidebarMenuItem>
            <SidebarMenuButton
              className="h-8 text-sm text-muted-foreground"
              isActive={pathname === listPath}
              render={
                <Link to="/$slug/projects" params={{ slug: workspace.slug }} />
              }
            >
              <FolderKanban aria-hidden="true" />
              <span>{t("switcher.all")}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
      <CreateProjectDialog
        workspace={workspace}
        open={creating}
        onOpenChange={setCreating}
      />
    </SidebarGroup>
  );
}
