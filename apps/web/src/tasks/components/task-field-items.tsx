import {
  type ProjectColumnRow,
  TASK_PRIORITIES,
  type TaskPriority,
} from "@morrow/sync-schemas";
import { useTranslation } from "react-i18next";
import {
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
} from "@/design-system/ui/menu";
import { localeWeekStart } from "../lib/calendar-day";
import { quickDueDates } from "../lib/due-date-picks";
import { DigitHint, DigitKeys, digitProps } from "./digit-keys";
import { TypedDueDate } from "./typed-due-date";
import { ColumnMarker } from "./column-marker";
import { PersonAvatar } from "./person-avatar";
import { TaskPriorityIcon } from "./task-priority-icon";
import type { Person } from "../queries/use-workspace-people";

/*
 * The choices of each field as menu items. A dropdown (chips, the sheet, a
 * keyboard shortcut) and a right-click menu's submenus both render these, so a
 * field offers the same choices wherever it is edited.
 */

export function PriorityItems({
  value,
  onSelect,
}: {
  /** Left out where several tasks are edited at once and none is current. */
  value?: TaskPriority;
  onSelect: (priority: TaskPriority) => void;
}) {
  const { t } = useTranslation("tasks");
  return (
    <MenuRadioGroup
      value={value ?? ""}
      onValueChange={(next) => onSelect(next as TaskPriority)}
    >
      <DigitKeys />
      {TASK_PRIORITIES.map((priority, index) => (
        <MenuRadioItem
          key={priority}
          value={priority}
          {...digitProps(index + 1)}
        >
          <span className="flex w-full items-center gap-2">
            <TaskPriorityIcon priority={priority} />
            {t(`priority.${priority}`)}
            <DigitHint n={index + 1} />
          </span>
        </MenuRadioItem>
      ))}
    </MenuRadioGroup>
  );
}

export function ColumnItems({
  columns,
  value,
  onSelect,
}: {
  columns: readonly ProjectColumnRow[];
  value?: string;
  onSelect: (columnId: string) => void;
}) {
  return (
    <MenuRadioGroup value={value ?? ""} onValueChange={onSelect}>
      <DigitKeys />
      {columns.map((column, index) => (
        <MenuRadioItem
          key={column.id}
          value={column.id}
          {...digitProps(index + 1)}
        >
          <span className="flex w-full items-center gap-2">
            <ColumnMarker column={column} />
            {column.name}
            <DigitHint n={index + 1} />
          </span>
        </MenuRadioItem>
      ))}
    </MenuRadioGroup>
  );
}

const NOBODY = "";

/**
 * Unassigned, then the people the user may assign: anyone with `task: assign`,
 * otherwise only themselves.
 */
export function AssigneeItems({
  people,
  meId,
  canAssign,
  value,
  onSelect,
}: {
  people: readonly Person[];
  meId: string;
  canAssign: boolean;
  value?: string | null;
  onSelect: (assigneeId: string | null) => void;
}) {
  const { t } = useTranslation("tasks");
  const choices = people.filter((person) => canAssign || person.id === meId);
  return (
    <MenuRadioGroup
      value={value === undefined ? "\0" : (value ?? NOBODY)}
      onValueChange={(next) => onSelect(next === NOBODY ? null : next)}
    >
      <DigitKeys />
      <MenuRadioItem value={NOBODY} {...digitProps(1)}>
        <span className="flex w-full items-center gap-2">
          {t("assignee.unassigned")}
          <DigitHint n={1} />
        </span>
      </MenuRadioItem>
      {choices.map((person, index) => (
        <MenuRadioItem
          key={person.id}
          value={person.id}
          {...digitProps(index + 2)}
        >
          <span className="flex w-full items-center gap-2">
            <PersonAvatar person={person} className="size-4" />
            {person.id === meId
              ? t("assignee.me", { name: person.name })
              : person.name}
            <DigitHint n={index + 2} />
          </span>
        </MenuRadioItem>
      ))}
    </MenuRadioGroup>
  );
}

/** A date of your own, today, tomorrow, this weekend, next week, or none. */
export function DueDateItems({
  today,
  hasValue,
  onSelect,
  onPickDate,
}: {
  /** Local calendar day, `YYYY-MM-DD`. */
  today: string;
  hasValue: boolean;
  onSelect: (dueDate: string | null) => void;
  /** Opens the date field for "Pick a date". */
  onPickDate: () => void;
}) {
  const { t } = useTranslation("tasks");
  return (
    <>
      <TypedDueDate today={today} onSelect={onSelect} />
      <MenuItem onClick={onPickDate}>{t("due.pick")}</MenuItem>
      {quickDueDates(today, localeWeekStart()).map(({ key, day }) => (
        <MenuItem key={key} onClick={() => onSelect(day)}>
          {t(`due.${key}`)}
        </MenuItem>
      ))}
      {hasValue ? (
        <MenuItem onClick={() => onSelect(null)}>{t("due.clear")}</MenuItem>
      ) : null}
    </>
  );
}
