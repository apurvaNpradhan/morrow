import type { TaskEvent } from "@morrow/sync-schemas";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import {
  formatDate,
  formatDateTime,
  formatRelativeTime,
} from "@/design-system/format";
import { parseDay } from "../lib/calendar-day";
import type { TimelineEvent } from "../lib/timeline";
import { PersonAvatar } from "./person-avatar";
import { TaskEventIcon } from "./task-event-icon";
import { useTaskView } from "./task-view-context";

/** A short date for a due-date entry. */
const day = (value: string) =>
  formatDate(parseDay(value), {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

/**
 * One history entry as a line: avatar, "who did what" and when. Names are the
 * live ones while the Column, label or Member still exists, and the snapshot
 * in the entry when it does not.
 */
export function TaskEventLine({ entry }: { entry: TimelineEvent }) {
  const { t } = useTranslation("tasks");
  const { columnById, labelById, personById } = useTaskView();
  const { row, event } = entry;
  const actor = row.actorId ? personById.get(row.actorId) : undefined;

  const columnName = (ref: { id: string; name: string }) =>
    columnById.get(ref.id)?.name ?? ref.name;
  const personName = (ref: { id: string; name: string } | null) =>
    ref ? (personById.get(ref.id)?.name ?? ref.name) : "";
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
        {sentence(t, event, { columnName, personName, labelNames })}
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
};

/** What the actor did, as the rest of the sentence. */
function sentence(t: TFunction, event: TaskEvent, names: Names): string {
  switch (event.type) {
    case "created":
      return t("history.created");
    case "imported":
      return t("history.imported");
    case "duplicated":
      return t("history.duplicated", { ticket: event.data.sourceTicketId });
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
        ? t("history.dueSet", { to: day(to) })
        : t("history.dueChanged", { from: day(from), to: day(to) });
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
    case "archived":
      return t("history.archived");
    case "unarchived":
      return t("history.unarchived");
    case "description":
      return t("history.description");
  }
}
