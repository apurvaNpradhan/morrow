import type { TaskRow } from "@morrow/sync-schemas";
import { ChevronRight, CornerLeftUp, ListPlus, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/design-system/cn";
import { Button } from "@/design-system/ui/button";
import { MenuItem } from "@/design-system/ui/menu";
import { useTaskActions } from "../actions/use-task-actions";
import { clearSelection } from "../lib/selection-store";
import { ProgressRing } from "./progress-ring";
import { SubTaskComposer } from "./sub-task-composer";
import { SubTaskDisplayMenu } from "./sub-task-display-menu";
import { SubTaskRows } from "./sub-task-rows";
import { TaskContextMenu } from "./task-context-menu";
import { useTaskView } from "./task-view-context";

/**
 * A task's sub-tasks in the sheet, Linear style: a header with the done count
 * and display options, the rows (nested, selectable, with the task context
 * menu) and an inline composer. Nothing shows to a viewer when there are none.
 * The selection belongs to this list: it starts empty and is dropped on close.
 */
export function TaskSubtasks({ task }: { task: TaskRow }) {
  const { t } = useTranslation("tasks");
  const { can, frozen } = useTaskView();
  const actions = useTaskActions();
  const [open, setOpen] = useState(true);
  // The task a new sub-task goes under: this one, or a row's from its menu.
  const [composeFor, setComposeFor] = useState<TaskRow | null>(null);
  const editable = can.create && !frozen;

  useEffect(() => {
    clearSelection();
    return clearSelection;
  }, []);

  if (task.subtaskTotal === 0 && !editable) return null;

  return (
    <section aria-label={t("subtasks.title")} className="space-y-1">
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-expanded={open}
          className="flex cursor-pointer items-center gap-1.5 rounded-md px-1 py-0.5 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setOpen(!open)}
        >
          <ChevronRight
            aria-hidden="true"
            className={cn("size-3.5 transition-transform", open && "rotate-90")}
          />
          {t("subtasks.title")}
          {task.subtaskTotal > 0 ? (
            <span className="ms-1 inline-flex items-center gap-1 tabular-nums">
              <ProgressRing done={task.subtaskDone} total={task.subtaskTotal} />
              {task.subtaskDone}/{task.subtaskTotal}
            </span>
          ) : null}
        </button>
        <span className="ms-auto flex items-center gap-0.5">
          <SubTaskDisplayMenu />
          {editable ? (
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={t("subtasks.add")}
              onClick={() => {
                setOpen(true);
                setComposeFor(task);
              }}
            >
              <Plus aria-hidden="true" />
            </Button>
          ) : null}
        </span>
      </div>
      {open ? (
        <TaskContextMenu
          extraItems={(row) => (
            <>
              {editable ? (
                <MenuItem
                  onClick={() => {
                    setOpen(true);
                    setComposeFor(row);
                  }}
                >
                  <ListPlus aria-hidden="true" />
                  {t("subtasks.addUnder")}
                </MenuItem>
              ) : null}
              {editable && row.parentId ? (
                <MenuItem onClick={() => void actions.setParent(row, null)}>
                  <CornerLeftUp aria-hidden="true" />
                  {t("subtasks.removeFromParent")}
                </MenuItem>
              ) : null}
            </>
          )}
        >
          <div className="-mx-4" role="list" aria-label={t("subtasks.title")}>
            <SubTaskRows parentId={task.id} />
          </div>
        </TaskContextMenu>
      ) : null}
      {editable && composeFor ? (
        <SubTaskComposer
          key={composeFor.id}
          parent={composeFor}
          onClose={() => setComposeFor(null)}
        />
      ) : null}
    </section>
  );
}
