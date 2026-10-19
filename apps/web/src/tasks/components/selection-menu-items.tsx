import {
  Archive,
  ArchiveRestore,
  CalendarDays,
  Tag,
  Trash2,
  UserRound,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  MenuItem,
  MenuSeparator,
  MenuSub,
  MenuSubPopup,
  MenuSubTrigger,
} from "@/design-system/ui/menu";
import { MenuHint } from "@/design-system/tooltip-label";
import { useBulkActions } from "../actions/use-bulk-actions";
import { openDatePicker } from "../lib/date-picker-store";
import { openFieldPicker } from "../lib/field-picker-store";
import { selectedTasks } from "../lib/selected-tasks";
import { archiveAction, overCap } from "../lib/selection";
import { SELECTION } from "../lib/selection-store";
import { useSelectedTasks } from "../queries/use-task-queries";
import { requestDeleteTasks } from "./delete-task-dialog";
import {
  AssigneeItems,
  ColumnItems,
  DueDateItems,
  PriorityItems,
} from "./task-field-items";
import { TaskPriorityIcon } from "./task-priority-icon";
import { useTaskView } from "./task-view-context";

/** The right-click menu of a selected task: every item acts on the whole selection. */
export function SelectionMenuItems({ anchor }: { anchor: Element | null }) {
  const { t } = useTranslation("tasks");
  const { project, columns, people, meId, today, can, frozen } = useTaskView();
  const bulk = useBulkActions();
  const tasks = useSelectedTasks(project.id);
  const editable = can.edit && !frozen;
  const capped = overCap(tasks.length);
  const unarchive = archiveAction(tasks) === "unarchive";

  return (
    <>
      {editable ? (
        <>
          <MenuSub>
            <MenuSubTrigger disabled={capped}>
              <TaskPriorityIcon priority="medium" />
              {t("fields.priority")}
              <MenuHint hotkeyId="setTaskPriority" />
            </MenuSubTrigger>
            <MenuSubPopup>
              <PriorityItems
                onSelect={(priority) => void bulk.setPriority(priority)}
              />
            </MenuSubPopup>
          </MenuSub>
          <MenuSub>
            <MenuSubTrigger disabled={capped}>
              {t("fields.column")}
              <MenuHint hotkeyId="setTaskColumn" />
            </MenuSubTrigger>
            <MenuSubPopup>
              <ColumnItems
                columns={columns}
                onSelect={(columnId) => void bulk.setColumn(columnId)}
              />
            </MenuSubPopup>
          </MenuSub>
          <MenuSub>
            <MenuSubTrigger disabled={capped}>
              <CalendarDays aria-hidden="true" />
              {t("fields.dueDate")}
              <MenuHint hotkeyId="setTaskDueDate" />
            </MenuSubTrigger>
            <MenuSubPopup>
              <DueDateItems
                today={today}
                hasValue={tasks.some((task) => task.dueDate !== null)}
                onSelect={(dueDate) => void bulk.setDueDate(dueDate)}
                onPickDate={() => openDatePicker(SELECTION)}
              />
            </MenuSubPopup>
          </MenuSub>
          <MenuSub>
            <MenuSubTrigger disabled={capped}>
              <UserRound aria-hidden="true" />
              {t("fields.assignee")}
              <MenuHint hotkeyId="assignTask" />
            </MenuSubTrigger>
            <MenuSubPopup>
              <AssigneeItems
                people={people}
                meId={meId}
                canAssign={can.assign}
                onSelect={(assigneeId) => void bulk.setAssignee(assigneeId)}
              />
            </MenuSubPopup>
          </MenuSub>
          <MenuItem
            disabled={capped || !anchor}
            onClick={() =>
              anchor && openFieldPicker(SELECTION, "labels", anchor)
            }
          >
            <Tag aria-hidden="true" />
            {t("selection.labels")}
            <MenuHint hotkeyId="setTaskLabels" />
          </MenuItem>
          <MenuSeparator />
          <MenuItem
            disabled={capped}
            onClick={() => void bulk.archive(!unarchive)}
          >
            {unarchive ? (
              <ArchiveRestore aria-hidden="true" />
            ) : (
              <Archive aria-hidden="true" />
            )}
            {unarchive ? t("menu.unarchive") : t("menu.archive")}
          </MenuItem>
        </>
      ) : null}
      {can.delete && !frozen ? (
        <MenuItem
          variant="destructive"
          disabled={capped}
          onClick={() => requestDeleteTasks(selectedTasks(project.id))}
        >
          <Trash2 aria-hidden="true" />
          {t("menu.delete")}
          <MenuHint hotkeyId="deleteTask" />
        </MenuItem>
      ) : null}
    </>
  );
}
