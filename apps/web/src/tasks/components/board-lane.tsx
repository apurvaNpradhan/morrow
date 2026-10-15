"use no memo";

import type { ProjectColumnRow, TaskRow } from "@morrow/sync-schemas";
import { useDroppable } from "@dnd-kit/react";
import { defaultRangeExtractor, useVirtualizer } from "@tanstack/react-virtual";
import { ChevronRight } from "lucide-react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/design-system/cn";
import { COLUMN_COLOR_CLASSES } from "@/projects";
import { Spinner } from "@/design-system/ui/spinner";
import { LaneHeader } from "./lane-header";
import { SortableTaskCard } from "./sortable-task-card";

/** A card's height before it is measured: two lines of title and a row of facts. */
const ESTIMATED_CARD_HEIGHT = 88;

/**
 * One Column of the board: its header, and its cards as a drop target. Only
 * the cards in view are rendered, however many the lane holds.
 */
export function BoardLane({
  column,
  tasks,
  expanded,
  loading,
  onToggle,
  activeId,
  registerScroll,
  empty,
}: {
  column: ProjectColumnRow;
  tasks: TaskRow[];
  /** A collapsed lane is its header only, and its tasks are not loaded. */
  expanded: boolean;
  loading: boolean;
  onToggle: () => void;
  /** The task being dragged; its card stays mounted when scrolled out of view. */
  activeId: string | null;
  /** Hands the board a way to scroll one of this lane's cards into view. */
  registerScroll: (
    columnId: string,
    scrollToIndex: ((index: number) => void) | null,
  ) => void;
  /** What an empty lane says: nothing yet, or nothing matching the filters. */
  empty: string;
}) {
  const { t } = useTranslation("tasks");
  const { ref, isDropTarget } = useDroppable({
    id: column.id,
    type: "column",
    accept: "task",
    data: { columnId: column.id },
    disabled: !expanded,
  });
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const activeAt = activeId
    ? tasks.findIndex((task) => task.id === activeId)
    : -1;
  const virtualizer = useVirtualizer({
    count: tasks.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATED_CARD_HEIGHT,
    getItemKey: (at) => tasks[at]!.id,
    overscan: 6,
    rangeExtractor: (range) => {
      const indexes = defaultRangeExtractor(range);
      if (activeAt === -1 || indexes.includes(activeAt)) return indexes;
      return [...indexes, activeAt].sort((a, b) => a - b);
    },
  });

  useEffect(() => {
    registerScroll(column.id, (index) =>
      virtualizer.scrollToIndex(index, { align: "auto" }),
    );
    return () => registerScroll(column.id, null);
  }, [column.id, registerScroll, virtualizer]);

  return (
    <section
      aria-label={column.name}
      className={cn(
        "flex w-72 shrink-0 flex-col self-start rounded-xl border bg-card/80",
        expanded && "h-full",
        COLUMN_COLOR_CLASSES[column.color].lane,
        isDropTarget && "ring-1 ring-ring",
      )}
    >
      <header
        className={cn(
          "flex items-center gap-1 px-3 py-2",
          expanded && "border-b",
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
            className={cn(
              "size-4 transition-transform",
              expanded && "rotate-90",
            )}
          />
        </button>
        <div className="min-w-0 flex-1">
          <LaneHeader column={column} count={expanded ? tasks.length : null} />
        </div>
      </header>
      {expanded ? (
        <div
          ref={(node) => {
            scrollRef.current = node;
            ref(node);
          }}
          role="list"
          data-lane={column.id}
          aria-label={t("board.laneTasks", { name: column.name })}
          className="min-h-16 flex-1 overflow-y-auto overflow-x-hidden p-2"
        >
          <div
            className="relative w-full"
            style={{ height: virtualizer.getTotalSize() }}
          >
            {virtualizer.getVirtualItems().map((item) => {
              const task = tasks[item.index]!;
              return (
                <div
                  key={item.key}
                  ref={virtualizer.measureElement}
                  role="listitem"
                  data-index={item.index}
                  className="absolute inset-x-0 top-0 pb-2"
                  style={{ transform: `translateY(${item.start}px)` }}
                >
                  <SortableTaskCard
                    task={task}
                    index={item.index}
                    laneId={column.id}
                  />
                </div>
              );
            })}
          </div>
          {loading ? (
            <div className="flex justify-center py-3">
              <Spinner />
            </div>
          ) : null}
          {!loading && tasks.length === 0 ? (
            <p className="px-1 py-2 text-xs text-muted-foreground">{empty}</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
