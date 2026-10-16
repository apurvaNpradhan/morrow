import { CalendarDays, Tag, UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TaskRow } from "@morrow/sync-schemas";
import { formatDate, formatDateTime } from "@/design-system/format";
import {
  Popover,
  PopoverPopup,
  PopoverTrigger,
} from "@/design-system/ui/popover";
import { LabelChips, labelsOfTask } from "@/labels";
import { useTaskActions } from "../actions/use-task-actions";
import { openDatePicker } from "../lib/date-picker-store";
import { parseDay } from "../lib/calendar-day";
import { ColumnMarker } from "./column-marker";
import { FieldChipMenu } from "./field-chip-menu";
import { PersonAvatar } from "./person-avatar";
import {
  AssigneeItems,
  ColumnItems,
  DueDateItems,
  PriorityItems,
} from "./task-field-items";
import { TaskLabelPicker } from "./task-label-picker";
import { TaskPriorityIcon } from "./task-priority-icon";
import { useTaskView } from "./task-view-context";

/**
 * A task's fields in the sheet: a rail on wide screens, a wrapping row of
 * chips on narrow ones. Read-only when the user cannot edit.
 */
export function TaskProperties({ task }: { task: TaskRow }) {
  const { t } = useTranslation("tasks");
  const {
    columns,
    columnById,
    labelById,
    people,
    personById,
    meId,
    today,
    can,
    frozen,
  } = useTaskView();
  const actions = useTaskActions();
  const editable = can.edit && !frozen;
  const column = columnById.get(task.columnId);
  const assignee = task.assigneeId
    ? personById.get(task.assigneeId)
    : undefined;
  const labels = labelsOfTask(task.labelIds, labelById);
  const creator = task.createdBy ? personById.get(task.createdBy) : undefined;

  return (
    <dl className="flex flex-wrap gap-2 lg:flex-col lg:gap-4">
      <Field label={t("fields.column")}>
        <FieldChipMenu
          label={t("fields.column")}
          sheetField="column"
          disabled={!editable}
          icon={column ? <ColumnMarker column={column} /> : null}
          value={column?.name ?? "—"}
        >
          <ColumnItems
            columns={columns}
            value={task.columnId}
            onSelect={(columnId) => void actions.setColumn(task, columnId)}
          />
        </FieldChipMenu>
      </Field>
      <Field label={t("fields.priority")}>
        <FieldChipMenu
          label={t("fields.priority")}
          sheetField="priority"
          disabled={!editable}
          icon={<TaskPriorityIcon priority={task.priority} />}
          value={t(`priority.${task.priority}`)}
        >
          <PriorityItems
            value={task.priority}
            onSelect={(priority) => void actions.setPriority(task, priority)}
          />
        </FieldChipMenu>
      </Field>
      <Field label={t("fields.assignee")}>
        <FieldChipMenu
          label={t("fields.assignee")}
          sheetField="assignee"
          disabled={!editable}
          icon={
            assignee ? (
              <PersonAvatar person={assignee} className="size-4" />
            ) : (
              <UserRound aria-hidden="true" className="size-3.5" />
            )
          }
          value={assignee?.name ?? t("assignee.unassigned")}
        >
          <AssigneeItems
            people={people}
            meId={meId}
            canAssign={can.assign}
            value={task.assigneeId}
            onSelect={(assigneeId) =>
              void actions.setAssignee(task, assigneeId)
            }
          />
        </FieldChipMenu>
      </Field>
      <Field label={t("fields.dueDate")}>
        <FieldChipMenu
          label={t("fields.dueDate")}
          sheetField="dueDate"
          disabled={!editable}
          icon={<CalendarDays aria-hidden="true" className="size-3.5" />}
          value={
            task.dueDate
              ? formatDate(parseDay(task.dueDate), {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : t("fields.noDueDate")
          }
        >
          <DueDateItems
            today={today}
            hasValue={task.dueDate !== null}
            onSelect={(dueDate) => void actions.setDueDate(task, dueDate)}
            onPickDate={() => openDatePicker(task.id)}
          />
        </FieldChipMenu>
      </Field>
      <Field label={t("fields.labels")}>
        <Popover>
          <PopoverTrigger
            disabled={!editable}
            aria-label={t("fields.labels")}
            data-sheet-field="labels"
            className="inline-flex min-h-7 max-w-full cursor-pointer flex-wrap items-center gap-1 rounded-md border bg-control px-2 py-1 text-xs outline-none hover:bg-control-hover focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-64"
          >
            {labels.length > 0 ? (
              <LabelChips labels={labels} max={6} />
            ) : (
              <>
                <Tag aria-hidden="true" className="size-3.5" />
                {t("labels.none")}
              </>
            )}
          </PopoverTrigger>
          <PopoverPopup>
            <TaskLabelPicker taskId={task.id} />
          </PopoverPopup>
        </Popover>
      </Field>
      <Field label={t("fields.createdBy")}>
        <span className="inline-flex h-7 items-center gap-1.5 text-xs">
          {creator?.name ?? t("sheet.unknownUser")}
        </span>
        <span className="block text-xs text-muted-foreground">
          {formatDateTime(task.createdAt)}
        </span>
      </Field>
    </dl>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
