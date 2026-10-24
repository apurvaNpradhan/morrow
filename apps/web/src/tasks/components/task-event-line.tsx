import {
  relationKind,
  type TaskEvent,
  type TaskEventFieldValueRef,
} from "@morrow/sync-schemas";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { formatDateTime, formatRelativeTime } from "@/design-system/format";
import { formatFieldDate, formatFieldNumber } from "../lib/field-value";
import { formatTaskDateText } from "../lib/format-task-date";
import type { TimelineEvent } from "../lib/timeline";
import { ticketsNamedBy, useLiveTickets } from "../queries/use-live-tickets";
import { PersonAvatar } from "./person-avatar";
import { TaskEventIcon } from "./task-event-icon";
import { useTaskView } from "./task-view-context";

/**
 * One history entry as a line: avatar, "who did what" and when. Names are the
 * live ones while the Column, label or Member still exists, and the snapshot
 * in the entry when it does not.
 */
export function TaskEventLine({ entry }: { entry: TimelineEvent }) {
  const { t } = useTranslation("tasks");
  const { workspace, columnById, fieldById, labelById, personById, timeZone } =
    useTaskView();
  const { row, event } = entry;
  const ticket = useLiveTickets(workspace.id, ticketsNamedBy(event));
  const actor = row.actorId ? personById.get(row.actorId) : undefined;

  /** A start or due date of an entry: the day, with the time for a moment. */
  const date = (text: string) =>
    formatTaskDateText(text, timeZone, { year: true });
  const columnName = (ref: { id: string; name: string }) =>
    columnById.get(ref.id)?.name ?? ref.name;
  const personName = (ref: { id: string; name: string } | null) =>
    ref ? (personById.get(ref.id)?.name ?? ref.name) : "";
  const fieldName = (ref: { id: string; name: string }) =>
    fieldById.get(ref.id)?.name ?? ref.name;
  /** A Field's held value in words: live option names, else the snapshot's. */
  const valueText = (fieldId: string, ref: TaskEventFieldValueRef) => {
    if (ref === null) return "";
    const field = fieldById.get(fieldId);
    const liveName = (option: { id: string; name: string }) =>
      field?.options.find((o) => o.id === option.id)?.name ?? option.name;
    if ("id" in ref) return liveName(ref);
    if ("options" in ref) return ref.options.map(liveName).join(", ");
    if (ref.value === true) return t("fieldValues.checked");
    if (typeof ref.value === "number") {
      return field
        ? formatFieldNumber(field.config, ref.value)
        : String(ref.value);
    }
    return field?.type === "date" ? formatFieldDate(ref.value) : ref.value;
  };
  const labelNames = (refs: readonly { id: string; name: string }[]) =>
    refs.map((ref) => labelById.get(ref.id)?.name ?? ref.name).join(", ");

  return (
    <li className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="flex size-5 shrink-0 items-center justify-center">
        <TaskEventIcon event={event} />
      </span>
      <PersonAvatar
        person={actor ?? { name: t("comments.deletedUser"), image: null }}
        className="size-5"
      />
      <span className="min-w-0 flex-1 truncate">
        <span className="font-medium text-foreground">
          {actor?.name ?? t("comments.deletedUser")}
        </span>{" "}
        {sentence(t, event, {
          columnName,
          personName,
          labelNames,
          fieldName,
          valueText,
          ticket,
          date,
        })}
      </span>
      <time
        dateTime={row.createdAt.toISOString()}
        title={formatDateTime(row.createdAt)}
        className="shrink-0"
      >
        {formatRelativeTime(row.createdAt)}
      </time>
    </li>
  );
}

type Names = {
  columnName: (ref: { id: string; name: string }) => string;
  personName: (ref: { id: string; name: string } | null) => string;
  labelNames: (refs: readonly { id: string; name: string }[]) => string;
  fieldName: (ref: { id: string; name: string }) => string;
  valueText: (fieldId: string, ref: TaskEventFieldValueRef) => string;
  /** The Ticket id a task has now, for one written into an entry. */
  ticket: (id: string) => string;
  /** A start or due date in words. */
  date: (text: string) => string;
};

/** What the actor did, as the rest of the sentence. */
function sentence(t: TFunction, event: TaskEvent, names: Names): string {
  switch (event.type) {
    case "created":
      return t("history.created");
    case "imported":
      return t("history.imported");
    case "duplicated":
      return t("history.duplicated", {
        ticket: names.ticket(event.data.sourceTicketId),
      });
    case "title":
      return t("history.title", event.data);
    case "column":
      return t("history.column", {
        from: names.columnName(event.data.from),
        to: names.columnName(event.data.to),
      });
    case "priority":
      return t("history.priority", {
        from: t(`priority.${event.data.from}`),
        to: t(`priority.${event.data.to}`),
      });
    case "assignee": {
      const { from, to } = event.data;
      if (to === null) {
        return t("history.unassigned", { from: names.personName(from) });
      }
      return from === null
        ? t("history.assigned", { to: names.personName(to) })
        : t("history.reassigned", {
            from: names.personName(from),
            to: names.personName(to),
          });
    }
    case "due_date": {
      const { from, to } = event.data;
      if (to === null) return t("history.dueCleared");
      return from === null
        ? t("history.dueSet", { to: names.date(to) })
        : t("history.dueChanged", {
            from: names.date(from),
            to: names.date(to),
          });
    }
    case "start_date": {
      const { from, to } = event.data;
      if (to === null) return t("history.startCleared");
      return from === null
        ? t("history.startSet", { to: names.date(to) })
        : t("history.startChanged", {
            from: names.date(from),
            to: names.date(to),
          });
    }
    case "labels": {
      const { added, removed } = event.data;
      if (added.length > 0 && removed.length > 0) {
        return t("history.labelsBoth", {
          added: names.labelNames(added),
          removed: names.labelNames(removed),
        });
      }
      return added.length > 0
        ? t("history.labelsAdded", {
            count: added.length,
            labels: names.labelNames(added),
          })
        : t("history.labelsRemoved", {
            count: removed.length,
            labels: names.labelNames(removed),
          });
    }
    case "field_changed": {
      const { field, from, to } = event.data;
      const name = names.fieldName(field);
      if (to === null) {
        return t("history.fieldCleared", {
          field: name,
          from: names.valueText(field.id, from),
        });
      }
      return from === null
        ? t("history.fieldSet", {
            field: name,
            to: names.valueText(field.id, to),
          })
        : t("history.fieldChanged", {
            field: name,
            from: names.valueText(field.id, from),
            to: names.valueText(field.id, to),
          });
    }
    case "archived":
      return t("history.archived");
    case "unarchived":
      return t("history.unarchived");
    case "description":
      return t("history.description");
    case "parent": {
      const { from, to } = event.data;
      if (to === null) {
        return t("history.parentCleared", { from: names.ticket(from ?? "") });
      }
      return from === null
        ? t("history.parentSet", { to: names.ticket(to) })
        : t("history.parentChanged", {
            from: names.ticket(from),
            to: names.ticket(to),
          });
    }
    case "subtask_added":
      return t("history.subtaskAdded", {
        ticket: names.ticket(event.data.ticketId),
      });
    case "subtask_removed":
      return t("history.subtaskRemoved", {
        ticket: names.ticket(event.data.ticketId),
      });
    case "project_moved": {
      const { from, to, droppedValues } = event.data;
      const moved = t("history.projectMoved", {
        from: from.ticketId,
        to: to.ticketId,
        column: to.column.name,
      });
      if (droppedValues.length === 0) return moved;
      const lost = droppedValues.map((dropped) =>
        t("history.projectMovedDropped", {
          field: dropped.field,
          value: Array.isArray(dropped.value)
            ? dropped.value.join(", ")
            : String(dropped.value),
        }),
      );
      return `${moved}. ${lost.join("; ")}`;
    }
    case "relation_added":
    case "relation_removed": {
      const { type, direction, ticketId } = event.data;
      const verb =
        event.type === "relation_added" ? "relationAdded" : "relationRemoved";
      return t(`history.${verb}.${relationKind(type, direction)}`, {
        ticket: names.ticket(ticketId),
      });
    }
  }
}
