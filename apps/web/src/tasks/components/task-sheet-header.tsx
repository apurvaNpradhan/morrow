import type { TaskRow } from "@morrow/sync-schemas";
import { useTranslation } from "react-i18next";
import { ProjectIcon } from "@/projects";
import { SheetTitle } from "@/design-system/ui/sheet";
import { useTaskActions } from "../actions/use-task-actions";
import { displayTicketId } from "../lib/task-links";
import { TaskHeaderActions } from "./task-header-actions";
import { useTaskView } from "./task-view-context";

/**
 * The sheet's top row: the Project and ticket id (click to copy it), and the task's actions. The sheet's own close button sits at the far end.
 */
export function TaskSheetHeader({ task }: { task: TaskRow }) {
  const { t } = useTranslation("tasks");
  const { project } = useTaskView();
  const actions = useTaskActions();
  const ticket = displayTicketId(project.key, task.number);

  return (
    <div className="flex items-center gap-1 border-b px-4 py-2 pe-14">
      <SheetTitle className="flex min-w-0 flex-1 items-center gap-1.5 text-sm font-normal">
        <ProjectIcon
          project={project}
          className="size-3.5 shrink-0 text-muted-foreground"
        />
        <span className="truncate text-muted-foreground">{project.name}</span>
        <span aria-hidden="true" className="text-muted-foreground">
          ›
        </span>
        <button
          type="button"
          title={t("sheet.copyId")}
          aria-label={t("sheet.copyIdLabel", { id: ticket })}
          className="rounded-sm px-1 font-mono text-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => void actions.copy(ticket)}
        >
          {ticket}
        </button>
      </SheetTitle>
      <TaskHeaderActions task={task} />
    </div>
  );
}
