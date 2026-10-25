import type { TaskRow } from "@morrow/sync-schemas";
import { useTranslation } from "react-i18next";
import { formatDate } from "@/design-system/format";
import { MenuItem, MenuSeparator } from "@/design-system/ui/menu";
import { useTaskActions } from "../actions/use-task-actions";
import { openRecurrenceDialog } from "../lib/recurrence-dialog-store";
import {
  dayFacts,
  presetOptions,
  RECURRENCE_PRESETS,
  ruleText,
} from "../lib/recurrence-presets";
import { useTaskView } from "./task-view-context";

/** "Monday", from a day's facts. */
export function weekdayName(date: Date, style: "long" | "short" = "long") {
  return formatDate(date, { weekday: style, timeZone: "UTC" });
}

/**
 * The menu items that make a task repeat: the presets of its due date, a
 * custom form, and "Don't repeat". Without a due date, or on a subtask, only
 * the reason is shown.
 */
export function RecurrenceItems({ task }: { task: TaskRow }) {
  const { t } = useTranslation("tasks");
  const actions = useTaskActions();
  const { timeZone } = useTaskView();

  if (task.parentId !== null) {
    return <MenuItem disabled>{t("repeat.subtask")}</MenuItem>;
  }
  if (task.dueAt === null) {
    return <MenuItem disabled>{t("repeat.needsDue")}</MenuItem>;
  }
  const due = { at: task.dueAt, hasTime: task.dueHasTime };
  const facts = dayFacts(due, timeZone);
  const day = new Date(Date.UTC(facts.year, facts.month - 1, facts.date));
  const label = (preset: (typeof RECURRENCE_PRESETS)[number]) =>
    t(`repeat.preset.${preset}`, {
      weekday: weekdayName(day),
      day: facts.date,
      nth: t(`repeat.nth.${facts.nth}`),
      date: formatDate(day, { month: "long", day: "numeric", timeZone: "UTC" }),
    });

  return (
    <>
      {RECURRENCE_PRESETS.map((preset) => (
        <MenuItem
          key={preset}
          onClick={() =>
            void actions.setRecurrence(
              task,
              ruleText(presetOptions(preset, due, timeZone), due, timeZone),
            )
          }
        >
          {label(preset)}
        </MenuItem>
      ))}
      <MenuItem onClick={() => openRecurrenceDialog(task.id)}>
        {t("repeat.custom")}
      </MenuItem>
      {task.recurrence !== null ? (
        <>
          <MenuSeparator />
          <MenuItem onClick={() => void actions.setRecurrence(task, null)}>
            {t("repeat.stop")}
          </MenuItem>
        </>
      ) : null}
    </>
  );
}
