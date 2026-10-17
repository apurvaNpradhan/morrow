import type { TaskRow } from "@morrow/sync-schemas";
import { Suspense, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useTaskCommands } from "../actions/use-task-commands";
import { setActiveTaskId } from "../lib/active-task-store";
import { arrowTarget } from "../lib/arrow-navigation";
import { focusTask } from "../lib/focus-task";
import { currentView } from "../lib/view-order-store";
import { useTaskViewPreferences } from "../lib/use-task-view-preferences";
import { BoardView } from "./board-view";
import { BoardSkeleton } from "./board-skeleton";
import { DeleteTaskDialog } from "./delete-task-dialog";
import { DueDateDialog } from "./due-date-dialog";
import { ListSkeleton } from "./list-skeleton";
import { ListView } from "./list-view";
import { TaskFieldPicker } from "./task-field-picker";
import { TaskContextMenu } from "./task-context-menu";
import { TaskSheet } from "./task-sheet";
import { useTaskView } from "./task-view-context";
import { useTaskHotkeys } from "./use-task-hotkeys";
import { useToolbarState } from "./use-toolbar-state";

/**
 * The inside of a Project page: the toolbar and the board or list, the sheet
 * of the open task, the shared pickers and dialogs, and the keyboard.
 */
export function TasksSurface({
  layout,
  ticketNumber,
  openTask,
  closeSheet,
}: {
  layout: "board" | "list";
  /** The ticket number open in the sheet; null when none is. */
  ticketNumber: number | null;
  openTask: (task: TaskRow) => void;
  closeSheet: () => void;
}) {
  const { t } = useTranslation("tasks");
  const { project } = useTaskView();
  const toolbar = useToolbarState();
  const preferences = useTaskViewPreferences(project.id);

  useTaskCommands();
  useEffect(() => () => setActiveTaskId(null), []);

  useTaskHotkeys({
    openTask,
    openNumber: ticketNumber,
    openFilter: () => toolbar.setFilterOpen(true),
    openDisplay: () => toolbar.setDisplayOpen(true),
    focusSearch: toolbar.focusSearch,
  });

  return (
    <>
      <TaskContextMenu>
        <div
          role="group"
          aria-label={t("pageTitle")}
          className="h-full"
          onFocus={(event) => {
            const id =
              event.target instanceof Element
                ? event.target.closest<HTMLElement>("[data-task-id]")?.dataset
                    .taskId
                : undefined;
            if (id) setActiveTaskId(id);
          }}
          onKeyDown={(event) => {
            if (
              event.defaultPrevented ||
              !(event.target instanceof HTMLElement) ||
              !event.target.matches("[data-task-id]")
            ) {
              return;
            }
            const next = arrowTarget(
              currentView(),
              event.key,
              event.target.dataset.taskId ?? "",
            );
            if (!next) return;
            event.preventDefault();
            focusTask(next.id);
          }}
        >
          <Suspense
            fallback={layout === "board" ? <BoardSkeleton /> : <ListSkeleton />}
          >
            {layout === "board" ? (
              <BoardView toolbar={toolbar} preferences={preferences} />
            ) : (
              <ListView toolbar={toolbar} preferences={preferences} />
            )}
          </Suspense>
        </div>
      </TaskContextMenu>
      <TaskSheet number={ticketNumber} onClose={closeSheet} />
      <TaskFieldPicker />
      <DueDateDialog />
      <DeleteTaskDialog
        onDeleted={(task) => {
          if (task.number === ticketNumber) closeSheet();
        }}
      />
    </>
  );
}
