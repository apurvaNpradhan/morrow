import type { TaskEvent } from "@morrow/sync-schemas";
import {
  Archive,
  ArchiveRestore,
  Calendar,
  Circle,
  CirclePlus,
  Copy,
  Flag,
  Link2,
  ListTree,
  SlidersHorizontal,
  Pencil,
  Tag,
  TextAlignStart,
  UserRound,
} from "lucide-react";
import { cn } from "@/design-system/cn";
import { ColumnMarker } from "./column-marker";
import { useTaskView } from "./task-view-context";

/**
 * The glyph at the start of a history entry. A move shows the Column's status
 * icon, as on the board; every other entry shows what changed.
 */
export function TaskEventIcon({
  event,
  className,
}: {
  event: TaskEvent;
  className?: string;
}) {
  const { columnById, statusFractions } = useTaskView();
  const icon = cn("size-4 shrink-0 text-muted-foreground", className);

  switch (event.type) {
    case "column": {
      const { to } = event.data;
      const column = columnById.get(to.id);
      return column ? (
        <ColumnMarker
          column={column}
          fraction={statusFractions.get(to.id)}
          className={className}
        />
      ) : (
        <Circle aria-hidden="true" className={icon} />
      );
    }
    case "priority":
      return <Flag aria-hidden="true" className={icon} />;
    case "assignee":
      return <UserRound aria-hidden="true" className={icon} />;
    case "due_date":
      return <Calendar aria-hidden="true" className={icon} />;
    case "labels":
      return <Tag aria-hidden="true" className={icon} />;
    case "field_changed":
      return <SlidersHorizontal aria-hidden="true" className={icon} />;
    case "title":
      return <Pencil aria-hidden="true" className={icon} />;
    case "description":
      return <TextAlignStart aria-hidden="true" className={icon} />;
    case "archived":
      return <Archive aria-hidden="true" className={icon} />;
    case "unarchived":
      return <ArchiveRestore aria-hidden="true" className={icon} />;
    case "created":
    case "imported":
      return <CirclePlus aria-hidden="true" className={icon} />;
    case "parent":
    case "subtask_added":
    case "subtask_removed":
      return <ListTree aria-hidden="true" className={icon} />;
    case "relation_added":
    case "relation_removed":
      return <Link2 aria-hidden="true" className={icon} />;
    case "duplicated":
      return <Copy aria-hidden="true" className={icon} />;
  }
}
