import { MAX_BULK_TASKS } from "@morrow/sync-schemas";
import {
  Archive,
  ArchiveRestore,
  CalendarArrowDown,
  CalendarDays,
  Circle,
  FolderInput,
  Tag,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useBulkActions } from "../actions/use-bulk-actions";
import { archiveAction, overCap } from "../lib/selection";
import {
  clearSelection,
  SELECTION,
  useSelectedIds,
} from "../lib/selection-store";
import { openFieldPicker, type PickerField } from "../lib/field-picker-store";
import { useSelectedTasks } from "../queries/use-task-queries";
import { requestMoveTasks } from "../lib/move-store";
import { requestDeleteTasks } from "./delete-task-dialog";
import { TaskPriorityIcon } from "./task-priority-icon";
import { useTaskView } from "./task-view-context";
import { selectedTasks } from "../lib/selected-tasks";
import { Button } from "@/design-system/ui/button";

/**
 * The chip that floats over the board or list while anything is selected: how
 * many, a button for each action, and clear. Past the cap the actions are off.
 */
export function SelectionBar() {
  const { t } = useTranslation("tasks");
  const { project, can, frozen } = useTaskView();
  const count = useSelectedIds(project.id).size;
  const tasks = useSelectedTasks(project.id);
  const bulk = useBulkActions();
  const editable = can.edit && !frozen;
  const deletable = can.delete && !frozen;
  if (count === 0 || (!editable && !deletable)) return null;

  const capped = overCap(count);
  const unarchive = archiveAction(tasks) === "unarchive";
  const hint = capped
    ? t("selection.capped", { max: MAX_BULK_TASKS })
    : undefined;
  const pick = (field: PickerField) => (event: { currentTarget: Element }) =>
    openFieldPicker(SELECTION, field, event.currentTarget);

  return (
    <div
      role="toolbar"
      aria-label={t("selection.count", { count })}
      data-selection-bar=""
      title={hint}
      className="fixed bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-0.5 rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg"
    >
      <span className="px-2 text-sm tabular-nums">
        {t("selection.count", { count })}
      </span>
      {capped ? (
        <span className="px-1 text-xs text-muted-foreground">{hint}</span>
      ) : null}
      {editable ? (
        <>
          <Button
            variant="ghost"
            size="icon-xs"
            disabled={capped}
            aria-label={t("fields.column")}
            onClick={pick("column")}
          >
            <Circle aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            disabled={capped}
            aria-label={t("fields.priority")}
            onClick={pick("priority")}
          >
            <TaskPriorityIcon priority="medium" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            disabled={capped}
            aria-label={t("fields.assignee")}
            onClick={pick("assignee")}
          >
            <UserRound aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            disabled={capped}
            aria-label={t("selection.labels")}
            onClick={pick("labels")}
          >
            <Tag aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            disabled={capped}
            aria-label={t("fields.startDate")}
            onClick={pick("startDate")}
          >
            <CalendarArrowDown aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            disabled={capped}
            aria-label={t("fields.dueDate")}
            onClick={pick("dueDate")}
          >
            <CalendarDays aria-hidden="true" />
          </Button>
          {can.create ? (
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={t("selection.move")}
              onClick={() => requestMoveTasks(selectedTasks(project.id))}
            >
              <FolderInput aria-hidden="true" />
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon-xs"
            disabled={capped}
            aria-label={
              unarchive ? t("selection.unarchive") : t("selection.archive")
            }
            onClick={() => void bulk.archive(!unarchive)}
          >
            {unarchive ? (
              <ArchiveRestore aria-hidden="true" />
            ) : (
              <Archive aria-hidden="true" />
            )}
          </Button>
        </>
      ) : null}
      {deletable ? (
        <Button
          variant="ghost"
          size="icon-xs"
          disabled={capped}
          aria-label={t("selection.delete")}
          onClick={() => requestDeleteTasks(selectedTasks(project.id))}
        >
          <Trash2 aria-hidden="true" />
        </Button>
      ) : null}
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={t("selection.clear")}
        onClick={clearSelection}
      >
        <X aria-hidden="true" />
      </Button>
    </div>
  );
}
