import { CalendarDays, SlidersHorizontal, Tag, UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TaskRow } from "@morrow/sync-schemas";
import { formatDate } from "@/design-system/format";
import {
  Popover,
  PopoverPopup,
  PopoverTrigger,
} from "@/design-system/ui/popover";
import { cn } from "@/design-system/cn";
import { LabelChips, LabelDot, labelsOfTask } from "@/labels";
import { optionHeld } from "../lib/field-value";
import { useTaskActions } from "../actions/use-task-actions";
import { openDatePicker } from "../lib/date-picker-store";
import { parseDay } from "../lib/calendar-day";
import { ColumnMarker } from "./column-marker";
import { FieldValueItems } from "./field-value-items";
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
    fields,
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

  return (
    <dl className="flex flex-wrap items-start gap-2 @min-[720px]:flex-col @min-[720px]:gap-0.5">
      <RailHeading>{t("sheet.properties")}</RailHeading>
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
          muted={task.priority === "none"}
          value={
            task.priority === "none"
              ? t("priority.set")
              : t(`priority.${task.priority}`)
          }
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
          muted={!assignee}
          value={assignee?.name ?? t("assignee.assign")}
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
          muted={!task.dueDate}
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
      {fields.length > 0 ? (
        <RailHeading>{t("fieldValues.heading")}</RailHeading>
      ) : null}
      {fields.map((field) => {
        const held = optionHeld(field, task.fieldValues);
        return (
          <Field key={field.id} label={field.name}>
            <FieldChipMenu
              label={field.name}
              sheetField={`field:${field.id}`}
              disabled={!editable}
              muted={!held}
              icon={
                held ? (
                  <LabelDot color={held.color} />
                ) : (
                  <SlidersHorizontal aria-hidden="true" className="size-3.5" />
                )
              }
              value={held?.name ?? field.name}
            >
              <FieldValueItems
                field={field}
                fieldValues={task.fieldValues}
                onSelect={(optionId) =>
                  void actions.setFieldValue(task, field.id, optionId)
                }
              />
            </FieldChipMenu>
          </Field>
        );
      })}
      <RailHeading>{t("fields.labels")}</RailHeading>
      <Field label={t("fields.labels")}>
        <Popover>
          <PopoverTrigger
            disabled={!editable}
            aria-label={t("fields.labels")}
            data-sheet-field="labels"
            className={cn(
              "inline-flex min-h-7 max-w-full cursor-pointer flex-wrap items-center gap-1 rounded-md px-2 py-1 text-xs outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-64 @min-[720px]:w-full @min-[720px]:min-h-8 @min-[720px]:text-sm",
              labels.length === 0 &&
                "border bg-control text-muted-foreground @min-[720px]:border-transparent @min-[720px]:bg-transparent",
            )}
          >
            {labels.length > 0 ? (
              <LabelChips
                labels={labels}
                max={6}
                chipClassName="h-6 max-w-40 gap-1.5 px-2 text-sm"
              />
            ) : (
              <>
                <Tag aria-hidden="true" className="size-3.5" />
                {t("labels.add")}
              </>
            )}
          </PopoverTrigger>
          <PopoverPopup>
            <TaskLabelPicker taskId={task.id} />
          </PopoverPopup>
        </Popover>
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
    <div className="@min-[720px]:w-full">
      <dt className="sr-only">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** A small group title in the rail; narrow views are one row of chips and have none. */
function RailHeading({ children }: { children: React.ReactNode }) {
  return (
    <dt
      aria-hidden="true"
      className="mt-3 mb-1 hidden px-2 text-xs font-medium text-muted-foreground first:mt-0 @min-[720px]:block"
    >
      {children}
    </dt>
  );
}
