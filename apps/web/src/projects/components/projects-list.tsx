import { GripVertical, Settings } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { errorMessage } from "@/app/lib/error-message";
import { cn } from "@/design-system/cn";
import { toast } from "@/design-system/toast";
import { Button } from "@/design-system/ui/button";
import { moveProject } from "../actions/project-actions";
import { useSortableList } from "../lib/use-sortable-list";
import type { ProjectRow } from "@morrow/sync-schemas";
import { ProjectIcon } from "./project-icon";

type ProjectsListProps = {
  slug: string;
  projects: ProjectRow[];
  /** Whether rows can be reordered and have a settings shortcut. */
  canEdit: boolean;
};

/** Projects as rows: icon, name, key, description. Reorderable when editable. */
export function ProjectsList({ slug, projects, canEdit }: ProjectsListProps) {
  const { t } = useTranslation("projects");
  const sortable = useSortableList({
    items: projects,
    disabled: !canEdit,
    onMove: (project, position) => moveProject(project.id, position),
    onError: (error) =>
      toast.error(errorMessage(t, error, t("list.reorderError"))),
  });

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border bg-card">
      {projects.map((project, index) => {
        const indicator = sortable.dropIndicator(project.id);
        return (
          <li
            key={project.id}
            {...sortable.rowProps(project, index)}
            className={cn(
              "group relative flex items-center gap-3 px-3 py-2.5",
              sortable.isDragging(project.id) && "opacity-50",
              indicator === "top" &&
                "before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-primary",
              indicator === "bottom" &&
                "after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary",
            )}
          >
            {canEdit ? (
              <button
                type="button"
                aria-label={t("list.reorderHandle", { name: project.name })}
                className="cursor-grab rounded text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                {...sortable.handleProps(project, index)}
              >
                <GripVertical aria-hidden="true" className="size-4" />
              </button>
            ) : null}
            <Link
              to="/$slug/projects/$key"
              params={{ slug, key: project.key }}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-lg border bg-background text-muted-foreground">
                <ProjectIcon project={project} className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span
                    data-slot="project-name"
                    className="truncate text-sm font-medium"
                  >
                    {project.name}
                  </span>
                  <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                    {project.key}
                  </span>
                </span>
                {project.description ? (
                  <span className="block truncate text-xs text-muted-foreground">
                    {project.description}
                  </span>
                ) : null}
              </span>
            </Link>
            {canEdit ? (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("list.settings", { name: project.name })}
                render={
                  <Link
                    to="/$slug/settings/projects/$key/general"
                    params={{ slug, key: project.key }}
                  />
                }
              >
                <Settings aria-hidden="true" />
              </Button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
