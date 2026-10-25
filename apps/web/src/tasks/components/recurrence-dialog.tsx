import {
  RECURRENCE_COUNT_MAX,
  RECURRENCE_INTERVAL_MAX,
  isCalendarDate,
  WEEKDAY_CODES,
  type RecurrenceFrequency,
  type RecurrenceOptions,
  type WeekdayCode,
} from "@morrow/sync-schemas";
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
import { Radio, RadioGroup } from "@/design-system/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/design-system/ui/select";
import { cn } from "@/design-system/cn";
import { useTaskActions } from "../actions/use-task-actions";
import { taskCollection } from "../collections/task-collection";
import {
  closeRecurrenceDialog,
  useRecurrenceDialogTask,
} from "../lib/recurrence-dialog-store";
import { dayFacts, ruleText } from "../lib/recurrence-presets";
import { weekdayName } from "./recurrence-items";
import { useTaskView } from "./task-view-context";

const UNITS: RecurrenceFrequency[] = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"];

/** The form behind "Custom…": every N days, weeks, months or years, on which days, and when it ends. */
export function RecurrenceDialog() {
  const taskId = useRecurrenceDialogTask();
  const task = taskId ? taskCollection.get(taskId) : undefined;
  return (
    <Dialog
      open={task !== undefined && task.dueAt !== null}
      onOpenChange={(open) => {
        if (!open) closeRecurrenceDialog();
      }}
    >
      {task && task.dueAt ? (
        <RecurrenceForm
          key={task.id}
          taskId={task.id}
          due={{ at: task.dueAt, hasTime: task.dueHasTime }}
        />
      ) : null}
    </Dialog>
  );
}

function RecurrenceForm({
  taskId,
  due,
}: {
  taskId: string;
  due: { at: Date; hasTime: boolean };
}) {
  const { t } = useTranslation("tasks");
  const actions = useTaskActions();
  const { timeZone } = useTaskView();
  const facts = dayFacts(due, timeZone);
  const [freq, setFreq] = useState<RecurrenceFrequency>("WEEKLY");
  const [interval, setIntervalText] = useState("1");
  const [days, setDays] = useState<WeekdayCode[]>([facts.weekday]);
  const [monthly, setMonthly] = useState<"day" | "nth">("day");
  const [ends, setEnds] = useState<"never" | "on" | "after">("never");
  const [until, setUntil] = useState(facts.day);
  const [count, setCount] = useState("10");

  const intervalValue = Number(interval);
  const countValue = Number(count);
  const valid =
    Number.isInteger(intervalValue) &&
    intervalValue >= 1 &&
    intervalValue <= RECURRENCE_INTERVAL_MAX &&
    (freq !== "WEEKLY" || days.length > 0) &&
    (ends !== "on" || (isCalendarDate(until) && until >= facts.day)) &&
    (ends !== "after" ||
      (Number.isInteger(countValue) &&
        countValue >= 1 &&
        countValue <= RECURRENCE_COUNT_MAX));

  function options(): RecurrenceOptions {
    return {
      freq,
      interval: intervalValue,
      ...(freq === "WEEKLY" && { byDay: days.map((day) => ({ day })) }),
      ...(freq === "MONTHLY" &&
        (monthly === "day"
          ? { byMonthDay: [facts.date] }
          : { byDay: [{ day: facts.weekday, nth: facts.nth }] })),
      ...(freq === "YEARLY" && {
        byMonth: [facts.month],
        byMonthDay: [facts.date],
      }),
      ...(ends === "on" && { until }),
      ...(ends === "after" && { count: countValue }),
    };
  }

  async function save() {
    const task = taskCollection.get(taskId);
    closeRecurrenceDialog();
    if (task) {
      await actions.setRecurrence(task, ruleText(options(), due, timeZone));
    }
  }

  const sample = new Date(Date.UTC(facts.year, facts.month - 1, facts.date));
  return (
    <DialogPopup className="w-full max-w-sm">
      <DialogHeader>
        <DialogTitle>{t("repeat.customTitle")}</DialogTitle>
      </DialogHeader>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (valid) void save();
        }}
        className="contents"
      >
        <DialogPanel className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-sm">
            <span>{t("repeat.every")}</span>
            <Input
              type="number"
              min={1}
              max={RECURRENCE_INTERVAL_MAX}
              className="w-20"
              value={interval}
              onChange={(event) => setIntervalText(event.target.value)}
              aria-label={t("repeat.interval")}
            />
            <Select
              value={freq}
              onValueChange={(value) => {
                if (value) setFreq(value as RecurrenceFrequency);
              }}
            >
              <SelectTrigger size="sm" aria-label={t("repeat.unit")}>
                <SelectValue>
                  {t(`repeat.unit_${freq}`, { count: intervalValue || 1 })}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {UNITS.map((unit) => (
                  <SelectItem key={unit} value={unit}>
                    {t(`repeat.unit_${unit}`, { count: intervalValue || 1 })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {freq === "WEEKLY" ? (
            <div
              role="group"
              aria-label={t("repeat.onDays")}
              className="flex flex-wrap gap-1"
            >
              {WEEKDAY_CODES.map((code, index) => {
                const on = days.includes(code);
                // 2026-10-26 is a Monday: the sample for each weekday's name.
                const name = weekdayName(
                  new Date(Date.UTC(2026, 9, 26 + index)),
                  "short",
                );
                return (
                  <button
                    key={code}
                    type="button"
                    aria-pressed={on}
                    className={cn(
                      "h-8 min-w-10 cursor-pointer rounded-md border px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      on
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-control hover:bg-control-hover",
                    )}
                    onClick={() =>
                      setDays(
                        on
                          ? days.filter((day) => day !== code)
                          : [...days, code],
                      )
                    }
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          ) : null}

          {freq === "MONTHLY" ? (
            <RadioGroup
              value={monthly}
              onValueChange={(value) => setMonthly(value as "day" | "nth")}
              aria-label={t("repeat.monthlyOn")}
              className="gap-2 text-sm"
            >
              <label className="flex items-center gap-2">
                <Radio value="day" />
                {t("repeat.monthDay", { day: facts.date })}
              </label>
              <label className="flex items-center gap-2">
                <Radio value="nth" />
                {t("repeat.monthNth", {
                  nth: t(`repeat.nth.${facts.nth}`),
                  weekday: weekdayName(sample),
                })}
              </label>
            </RadioGroup>
          ) : null}

          <RadioGroup
            value={ends}
            onValueChange={(value) =>
              setEnds(value as "never" | "on" | "after")
            }
            aria-label={t("repeat.ends")}
            className="gap-2 text-sm"
          >
            <label className="flex items-center gap-2">
              <Radio value="never" />
              {t("repeat.endsNever")}
            </label>
            <label className="flex items-center gap-2">
              <Radio value="on" />
              {t("repeat.endsOn")}
              <Input
                type="date"
                size="sm"
                className="w-40"
                min={facts.day}
                disabled={ends !== "on"}
                value={until}
                onChange={(event) => setUntil(event.target.value)}
                aria-label={t("repeat.endsOn")}
              />
            </label>
            <label className="flex items-center gap-2">
              <Radio value="after" />
              {t("repeat.endsAfter")}
              <Input
                type="number"
                size="sm"
                min={1}
                max={RECURRENCE_COUNT_MAX}
                className="w-20"
                disabled={ends !== "after"}
                value={count}
                onChange={(event) => setCount(event.target.value)}
                aria-label={t("repeat.endsAfter")}
              />
              {t("repeat.occurrences")}
            </label>
          </RadioGroup>
        </DialogPanel>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={closeRecurrenceDialog}
          >
            {t("common:actions.cancel")}
          </Button>
          <Button type="submit" size="sm" disabled={!valid}>
            {t("repeat.save")}
          </Button>
        </DialogFooter>
      </form>
    </DialogPopup>
  );
}
