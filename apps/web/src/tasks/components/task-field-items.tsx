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
  value: TaskPriority;
  onSelect: (priority: TaskPriority) => void;
}) {
  const { t } = useTranslation("tasks");
  return (
    <MenuRadioGroup
      value={value}
      onValueChange={(next) => onSelect(next as TaskPriority)}
    >
      {TASK_PRIORITIES.map((priority) => (
        <MenuRadioItem key={priority} value={priority}>
          <span className="flex items-center gap-2">
            <TaskPriorityIcon priority={priority} />
            {t(`priority.${priority}`)}
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
  value: string;
  onSelect: (columnId: string) => void;
}) {
  return (
    <MenuRadioGroup value={value} onValueChange={onSelect}>
      {columns.map((column) => (
        <MenuRadioItem key={column.id} value={column.id}>
          <span className="flex items-center gap-2">
            <ColumnMarker column={column} />
            {column.name}
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
  value: string | null;
  onSelect: (assigneeId: string | null) => void;
}) {
  const { t } = useTranslation("tasks");
  const choices = people.filter((person) => canAssign || person.id === meId);
  return (
    <MenuRadioGroup
      value={value ?? NOBODY}
      onValueChange={(next) => onSelect(next === NOBODY ? null : next)}
    >
      <MenuRadioItem value={NOBODY}>{t("assignee.unassigned")}</MenuRadioItem>
      {choices.map((person) => (
        <MenuRadioItem key={person.id} value={person.id}>
          <span className="flex items-center gap-2">
            <PersonAvatar person={person} className="size-4" />
            {person.id === meId
              ? t("assignee.me", { name: person.name })
              : person.name}
          </span>
        </MenuRadioItem>
      ))}
    </MenuRadioGroup>
  );
}

/** Today, tomorrow, this weekend, next week, a date of your own, or none. */
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
      {quickDueDates(today, localeWeekStart()).map(({ key, day }) => (
        <MenuItem key={key} onClick={() => onSelect(day)}>
          {t(`due.${key}`)}
        </MenuItem>
      ))}
      <MenuItem onClick={onPickDate}>{t("due.pick")}</MenuItem>
      {hasValue ? (
        <MenuItem onClick={() => onSelect(null)}>{t("due.clear")}</MenuItem>
      ) : null}
    </>
  );
}
