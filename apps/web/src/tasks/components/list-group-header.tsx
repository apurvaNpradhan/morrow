import type { ProjectColumnRow } from "@morrow/sync-schemas";
import { useDroppable } from "@dnd-kit/react";
import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/design-system/cn";
import { LaneHeader } from "./lane-header";

/**
 * The header of one Column of the list. It collapses the group, and while a
 * task is dragged it is where that task is dropped into the Column (the rows
 * below are drop targets of their own).
 */
export function ListGroupHeader({
  column,
  expanded,
  count,
  onToggle,
}: {
  column: ProjectColumnRow;
  expanded: boolean;
  /** Tasks in the group; unknown while it is collapsed and not loaded. */
  count: number | null;
  onToggle: () => void;
}) {
  const { t } = useTranslation("tasks");
  const { ref, isDropTarget } = useDroppable({
    id: column.id,
    type: "column",
    accept: "task",
    data: { columnId: column.id },
    disabled: !expanded,
  });

  return (
    <div
      ref={ref}
      className={cn(
        "flex h-9 items-center gap-1 border-b bg-muted/30 px-3.5",
        isDropTarget && "bg-accent/30",
      )}
    >
      <button
        type="button"
        aria-expanded={expanded}
        aria-label={t(expanded ? "list.collapse" : "list.expand", {
          name: column.name,
        })}
        className="rounded-sm p-0.5 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
        onClick={onToggle}
      >
        <ChevronRight
          aria-hidden="true"
          className={cn("size-4 transition-transform", expanded && "rotate-90")}
        />
      </button>
      <div className="min-w-0 flex-1">
        <LaneHeader column={column} count={count} />
      </div>
    </div>
  );
}
