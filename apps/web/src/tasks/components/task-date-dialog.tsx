import { isCalendarDate, timeInZone } from "@morrow/sync-schemas";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/design-system/ui/button";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/design-system/ui/dialog";
import { Input } from "@/design-system/ui/input";
import { useTimeZone } from "@/app/hooks/use-time-zone";
import { useBulkActions } from "../actions/use-bulk-actions";
import { useTaskActions } from "../actions/use-task-actions";
import { taskCollection } from "../collections/task-collection";
import { formatDate } from "@/design-system/format";
import { parseDay } from "../lib/calendar-day";
import {
  formatTaskTime,
  splitTaskDateText,
  taskDateText,
} from "../lib/format-task-date";
import { dueDay, dueText, startText } from "../lib/due-date";
import { parseDateQuery } from "../lib/parse-date-query";
import { useToday } from "../queries/use-today";
import {
  closeDatePicker,
  type DateField,
  useDatePicker,
} from "../lib/date-picker-store";
import { SELECTION } from "../lib/selection-store";

/** A calendar field for "Pick a date", opened from any start or due date menu. */
export function TaskDateDialog() {
  const picker = useDatePicker();
  const timeZone = useTimeZone();
  const taskId = picker?.taskId ?? null;
  const forSelection = picker !== null && taskId === SELECTION;
  const task = taskId && !forSelection ? taskCollection.get(taskId) : undefined;
  return (
    <Dialog
      open={task !== undefined || forSelection}
      onOpenChange={(open) => {
        if (!open) closeDatePicker();
      }}
    >
      {forSelection ? (
        <TaskDateForm
          key={`${SELECTION}:${picker.field}`}
          taskId={SELECTION}
          field={picker.field}
          initial={null}
          latest={undefined}
        />
      ) : task && picker ? (
        <TaskDateForm
          // A new task or date starts the field afresh.
          key={`${task.id}:${picker.field}`}
          taskId={task.id}
          field={picker.field}
          initial={
            picker.field === "startDate" ? startText(task) : dueText(task)
          }
          // A start date cannot pass the due date.
          latest={
            picker.field === "startDate"
              ? (dueDay(task, timeZone) ?? undefined)
              : undefined
          }
        />
      ) : null}
    </Dialog>
  );
}

function TaskDateForm({
  taskId,
  field,
  initial,
  latest,
}: {
  taskId: string;
  field: DateField;
  /** The task's date as text (`YYYY-MM-DD` or ISO), if it has one. */
  initial: string | null;
  /** The last day that may be picked: the due date, for a start. */
  latest: string | undefined;
}) {
  const { t } = useTranslation("tasks");
  const actions = useTaskActions();
  const bulk = useBulkActions();
  const timeZone = useTimeZone();
  const [value, setValue] = useState(() =>
    splitTaskDateText(initial, timeZone),
  );
  const [query, setQuery] = useState("");
  const today = useToday();
  const typed = parseDateQuery(query, today, timeInZone(new Date(), timeZone));
  const allowed = (day: string) => latest === undefined || day <= latest;
  const valid = isCalendarDate(value.day) && allowed(value.day);
  const typedAllowed = typed !== null && allowed(typed.day);

  async function save(text: string) {
    const task = taskCollection.get(taskId);
    closeDatePicker();
    if (taskId === SELECTION) {
      await (field === "startDate"
        ? bulk.setStartDate(text)
        : bulk.setDueDate(text));
    } else if (task) {
      await (field === "startDate"
        ? actions.setStartDate(task, text)
        : actions.setDueDate(task, text));
    }
  }
  const saveTyped = () =>
    typedAllowed &&
    typed &&
    save(taskDateText(typed.day, typed.time, timeZone));
  const saveFields = () =>
    save(taskDateText(value.day, value.time || undefined, timeZone));

  return (
    <DialogPopup className="w-full max-w-xs">
      <DialogHeader>
        <DialogTitle>{t(`due.pickTitle.${field}`)}</DialogTitle>
      </DialogHeader>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (typed) void saveTyped();
          else if (valid && !query.trim()) void saveFields();
        }}
        className="contents"
      >
        <DialogPanel>
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("due.typeHint")}
            aria-label={t("due.typeHint")}
          />
          {typed ? (
            <p className="mt-1.5 text-muted-foreground text-xs">
              {t("due.typeResult", {
                date: `${formatDate(parseDay(typed.day), {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}${
                  typed.time
                    ? `, ${formatTaskTime(
                        new Date(taskDateText(typed.day, typed.time, timeZone)),
                        timeZone,
                      )}`
                    : ""
                }`,
              })}
            </p>
          ) : null}
          <div className="mt-3 flex gap-2">
            <Input
              type="date"
              value={value.day}
              max={latest}
              onChange={(event) =>
                setValue({ ...value, day: event.target.value })
              }
              aria-label={t(`fields.${field}`)}
            />
            <Input
              type="time"
              className="w-32"
              value={value.time}
              disabled={!valid}
              onChange={(event) =>
                setValue({ ...value, time: event.target.value })
              }
              aria-label={t("due.time")}
            />
          </div>
        </DialogPanel>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={closeDatePicker}
          >
            {t("common:actions.cancel")}
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={query.trim() ? !typedAllowed : !valid}
          >
            {t("due.set")}
          </Button>
        </DialogFooter>
      </form>
    </DialogPopup>
  );
}
