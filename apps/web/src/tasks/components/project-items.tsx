import { useTranslation } from "react-i18next";
import { MenuItem } from "@/design-system/ui/menu";
import { ProjectIcon, useProjectsWithoutSuspense } from "@/projects";
import { chooseMoveProject, requestMoveTasks } from "../lib/move-store";
import { useTaskView } from "./task-view-context";
import type { TaskRow } from "@morrow/sync-schemas";

/**
 * The Projects a task can move to, as menu items. Picking one starts the same
 * move as "Move to project": the dialog asks about Columns and Fields, or
 * moves at once when there is nothing to ask.
 */
export function ProjectItems({ task }: { task: TaskRow }) {
  const { t } = useTranslation("tasks");
  const { workspace, project } = useTaskView();
  // Archived Projects are read-only.
  const destinations = useProjectsWithoutSuspense(workspace.id).filter(
    (candidate) => candidate.id !== project.id && !candidate.archivedAt,
  );
  if (destinations.length === 0) {
    return <MenuItem disabled>{t("move.empty")}</MenuItem>;
  }
  return (
    <>
      {destinations.map((candidate) => (
        <MenuItem
          key={candidate.id}
          onClick={() => {
            requestMoveTasks([task]);
            chooseMoveProject(candidate);
          }}
        >
          <ProjectIcon project={candidate} />
          <span className="flex-1 truncate">{candidate.name}</span>
          <span className="text-muted-foreground text-xs">{candidate.key}</span>
        </MenuItem>
      ))}
    </>
  );
}
