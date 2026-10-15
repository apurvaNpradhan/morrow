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
import { useTaskActions } from "../actions/use-task-actions";
import { taskCollection } from "../collections/task-collection";
import { closeDatePicker, useDatePickerTask } from "../lib/date-picker-store";

/** A calendar field for "Pick a date", opened from any due-date menu. */
export function DueDateDialog() {
  const taskId = useDatePickerTask();
  const task = taskId ? taskCollection.get(taskId) : undefined;
  return (
    <Dialog
      open={task !== undefined}
      onOpenChange={(open) => {
        if (!open) closeDatePicker();
      }}
    >
      {task ? (
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
  const [value, setValue] = useState(initial);
  const valid = isCalendarDate(value);

  async function save() {
    const task = taskCollection.get(taskId);
    closeDatePicker();
    if (task) await actions.setDueDate(task, value);
  }

  return (
    <DialogPopup className="w-full max-w-xs">
      <DialogHeader>
        <DialogTitle>{t("due.pickTitle")}</DialogTitle>
      </DialogHeader>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (valid) void save();
        }}
        className="contents"
      >
        <DialogPanel>
          <Input
            type="date"
            autoFocus
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
          <Button type="submit" size="sm" disabled={!valid}>
            {t("due.set")}
          </Button>
        </DialogFooter>
      </form>
    </DialogPopup>
  );
}
