import { Collapsible } from "@base-ui/react/collapsible";
import { ChevronDown, Plus } from "lucide-react";
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
import { useProjectsWithoutSuspense } from "../queries/use-projects";
import { CreateProjectDialog } from "./create-project-dialog";
import { ProjectMenu } from "./project-menu";
import { ProjectIcon } from "./project-icon";

const OPEN_KEY = "morrow:sidebar-projects-open";

function readOpen() {
  try {
    return localStorage.getItem(OPEN_KEY) !== "false";
  } catch {
    return true;
  }
}

function writeOpen(open: boolean) {
  try {
    localStorage.setItem(OPEN_KEY, String(open));
  } catch {
    // Remembering the fold state is a convenience; the sidebar works without it.
  }
}

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
  const [open, setOpen] = useState(readOpen);
  const projects = useProjectsWithoutSuspense(workspace.id).filter(
    (project) => !project.archivedAt,
  );
  const listPath = `/${workspace.slug}/projects`;

  return (
    <SidebarGroup className="gap-1 p-2">
      <Collapsible.Root
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          writeOpen(next);
        }}
      >
        <SidebarGroupLabel
          render={
            <Collapsible.Trigger className="group/projects w-full cursor-pointer gap-1 hover:text-sidebar-accent-foreground" />
          }
        >
          {t("sidebar.title")}
          <ChevronDown
            aria-hidden="true"
            className="size-3.5 transition-transform duration-150 group-not-data-[panel-open]/projects:-rotate-90 motion-reduce:transition-none"
          />
        </SidebarGroupLabel>
        {canCreateProjects() ? (
          <SidebarGroupAction
            aria-label={t("sidebar.create")}
            title={t("sidebar.create")}
            onClick={() => setCreating(true)}
          >
            <Plus aria-hidden="true" />
          </SidebarGroupAction>
        ) : null}
        <Collapsible.Panel className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none">
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {projects.map((project) => {
                const path = `${listPath}/${project.key}`;
                return (
                  <SidebarMenuItem key={project.id}>
                    <SidebarMenuButton
                      className="h-8 text-sm"
                      tooltip={project.name}
                      isActive={
                        pathname === path || pathname.startsWith(`${path}/`)
                      }
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
                    <ProjectMenu workspace={workspace} project={project} />
                  </SidebarMenuItem>
                );
              })}
              {projects.length === 0 ? (
                <li className="px-2 py-1 text-xs text-muted-foreground">
                  {t("sidebar.empty")}
                </li>
              ) : null}
            </SidebarMenu>
          </SidebarGroupContent>
        </Collapsible.Panel>
      </Collapsible.Root>
      <CreateProjectDialog
        workspace={workspace}
        open={creating}
        onOpenChange={setCreating}
      />
    </SidebarGroup>
  );
}
