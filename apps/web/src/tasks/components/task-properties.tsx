import { CalendarDays, Tag, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TaskRow } from "@morrow/sync-schemas";
import { formatDate } from "@/design-system/format";
import {
  Popover,
  PopoverPopup,
  PopoverTrigger,
} from "@/design-system/ui/popover";
import { cn } from "@/design-system/cn";
import { LabelChips, labelsOfTask } from "@/labels";
import { fieldHeld } from "../lib/field-value";
import { useTaskActions } from "../actions/use-task-actions";
import { openDatePicker } from "../lib/date-picker-store";
import { parseDay } from "../lib/calendar-day";
import { REVEAL_SHEET_FIELD } from "./reveal-sheet-field";
import { ColumnMarker } from "./column-marker";
import { FieldValueItems } from "./field-value-items";
import { FieldChipMenu } from "./field-chip-menu";
import { useFieldChipFace } from "./use-field-chip-face";
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
 * chips on narrow ones. Read-only when the user cannot edit. Due date and
 * custom Fields show only once they have a value or a shortcut adds them; what
 * was added stays until the task closes.
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
  const chipFace = useFieldChipFace();
  const editable = can.edit && !frozen;
  const column = columnById.get(task.columnId);
  const assignee = task.assigneeId
    ? personById.get(task.assigneeId)
    : undefined;
  const labels = labelsOfTask(task.labelIds, labelById);
  const [added, setAdded] = useState<{ names: string[]; open: string | null }>({
    names: [],
    open: null,
  });
  const showDueDate = task.dueDate !== null || added.names.includes("dueDate");
  const unsetFields = fields.filter(
    (field) => fieldHeld(field, task.fieldValues) === undefined,
  );
  const shownFields = fields.filter(
    (field) =>
      fieldHeld(field, task.fieldValues) !== undefined ||
      added.names.includes(`field:${field.id}`),
  );
  const addable = [
    ...(showDueDate
      ? []
      : [{ sheetField: "dueDate", label: t("fields.dueDate") }]),
    ...unsetFields
      .filter((field) => !added.names.includes(`field:${field.id}`))
      .map((field) => ({ sheetField: `field:${field.id}`, label: field.name })),
  ];

  function add(sheetField: string) {
    setAdded((current) => ({
      names: [...current.names, sheetField],
      open: sheetField,
    }));
  }

  // The chip is only there after the render that adds it, so it opens then.
  useEffect(() => {
    if (!added.open) return;
    document
      .querySelector<HTMLElement>(`[data-sheet-field="${added.open}"]`)
      ?.click();
    setAdded((current) => ({ ...current, open: null }));
  }, [added.open]);

  // A shortcut for a property that is not shown yet adds it.
  useEffect(() => {
    if (!editable) return;
    function onReveal(event: Event) {
      const name = (event as CustomEvent<string>).detail;
      const target = name === "field" ? `field:${unsetFields[0]?.id}` : name;
      if (addable.some((property) => property.sheetField === target)) {
        add(target);
      }
    }
    window.addEventListener(REVEAL_SHEET_FIELD, onReveal);
    return () => window.removeEventListener(REVEAL_SHEET_FIELD, onReveal);
  });

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
      {showDueDate ? (
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
      ) : null}
      {shownFields.length > 0 ? (
        <RailHeading>{t("fieldValues.heading")}</RailHeading>
      ) : null}
      {shownFields.map((field) => {
        const held = fieldHeld(field, task.fieldValues);
        const face = chipFace(field, held);
        return (
          <Field key={field.id} label={field.name}>
            <FieldChipMenu
              label={field.name}
              sheetField={`field:${field.id}`}
              disabled={!editable}
              muted={face.muted}
              icon={face.icon}
              value={face.text}
            >
              <FieldValueItems
                field={field}
                value={held}
                onSelect={(value) =>
                  void actions.setFieldValue(task, field.id, value)
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
