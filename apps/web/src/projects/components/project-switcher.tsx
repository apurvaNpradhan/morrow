import { Link } from "@tanstack/react-router";
import { Check, ChevronsUpDown, FolderKanban } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "@/design-system/ui/menu";
import { useProjectsOutsidePages } from "../queries/use-projects";
import { ProjectIcon } from "./project-icon";

type ProjectSwitcherProps = {
  workspace: { id: string; slug: string };
  current: { id: string; key: string; name: string; icon: string | null };
};

/** The breadcrumb entry of a project page: names it and jumps to another one. */
export function ProjectSwitcher({ workspace, current }: ProjectSwitcherProps) {
  const { t } = useTranslation("projects");
  const projects = useProjectsOutsidePages(workspace.id).filter(
    (project) => !project.archivedAt || project.id === current.id,
  );

  return (
    <Menu>
      <MenuTrigger
        aria-label={t("switcher.label")}
        className="-mx-1 inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 text-xs text-card-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ProjectIcon project={current} className="size-3.5" />
        <span className="max-w-48 truncate">{current.name}</span>
        <ChevronsUpDown aria-hidden="true" className="size-3 opacity-60" />
      </MenuTrigger>
      <MenuPopup align="start">
        {projects.map((project) => (
          <MenuItem
            key={project.id}
            render={
              <Link
                to="/$slug/projects/$key"
                params={{ slug: workspace.slug, key: project.key }}
              />
            }
          >
            <ProjectIcon project={project} />
            <span className="flex-1 truncate">{project.name}</span>
            {project.id === current.id ? (
              <Check aria-hidden="true" className="size-4" />
            ) : null}
          </MenuItem>
        ))}
        <MenuSeparator />
        <MenuItem
          render={
            <Link to="/$slug/projects" params={{ slug: workspace.slug }} />
          }
        >
          <FolderKanban aria-hidden="true" />
          {t("switcher.all")}
        </MenuItem>
      </MenuPopup>
    </Menu>
  );
}
