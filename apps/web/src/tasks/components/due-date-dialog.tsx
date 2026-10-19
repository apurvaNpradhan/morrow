import { isCalendarDate } from "@morrow/sync-schemas";
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
import { useBulkActions } from "../actions/use-bulk-actions";
import { useTaskActions } from "../actions/use-task-actions";
import { taskCollection } from "../collections/task-collection";
import { formatDate } from "@/design-system/format";
import { parseDay } from "../lib/calendar-day";
import { parseDateQuery } from "../lib/parse-date-query";
import { useToday } from "../queries/use-today";
import { closeDatePicker, useDatePickerTask } from "../lib/date-picker-store";
import { SELECTION } from "../lib/selection-store";

/** A calendar field for "Pick a date", opened from any due-date menu. */
export function DueDateDialog() {
  const taskId = useDatePickerTask();
  const forSelection = taskId === SELECTION;
  const task = taskId && !forSelection ? taskCollection.get(taskId) : undefined;
  return (
    <Dialog
      open={task !== undefined || forSelection}
      onOpenChange={(open) => {
        if (!open) closeDatePicker();
      }}
    >
      {forSelection ? (
        <DueDateForm key={SELECTION} taskId={SELECTION} initial="" />
      ) : task ? (
        <DueDateForm
          // A new task starts the field afresh.
          key={task.id}
          taskId={task.id}
          initial={task.dueDate ?? ""}
        />
      ) : null}
    </Dialog>
  );
}

function DueDateForm({ taskId, initial }: { taskId: string; initial: string }) {
  const { t } = useTranslation("tasks");
  const actions = useTaskActions();
  const bulk = useBulkActions();
  const [value, setValue] = useState(initial);
  const [query, setQuery] = useState("");
  const today = useToday();
  const typed = parseDateQuery(query, today);
  const valid = isCalendarDate(value);

  async function save(day: string) {
    const task = taskCollection.get(taskId);
    closeDatePicker();
    if (taskId === SELECTION) await bulk.setDueDate(day);
    else if (task) await actions.setDueDate(task, day);
  }

  return (
    <DialogPopup className="w-full max-w-xs">
      <DialogHeader>
        <DialogTitle>{t("due.pickTitle")}</DialogTitle>
      </DialogHeader>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (typed) void save(typed);
          else if (valid && !query.trim()) void save(value);
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
                date: formatDate(parseDay(typed), {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                }),
              })}
            </p>
          ) : null}
          <Input
            className="mt-3"
            type="date"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            aria-label={t("fields.dueDate")}
          />
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
            disabled={query.trim() ? !typed : !valid}
          >
            {t("due.set")}
          </Button>
        </DialogFooter>
      </form>
    </DialogPopup>
  );
}
