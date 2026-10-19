"use no memo";

import type { ProjectColumnRow, TaskRow } from "@morrow/sync-schemas";
import { DragDropProvider, DragOverlay } from "@dnd-kit/react";
import { defaultRangeExtractor, useVirtualizer } from "@tanstack/react-virtual";
import { type CSSProperties, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Spinner } from "@/design-system/ui/spinner";
import { useTaskActions } from "../actions/use-task-actions";
import { useTaskView } from "./task-view-context";
import { ArchivedGroupHeader } from "./archived-group-header";
import { ListGroupHeader } from "./list-group-header";
import { SortableTaskListRow } from "./sortable-task-list-row";
import { TaskListRow } from "./task-list-row";
import { type Lanes, useLaneDnd } from "./use-lane-dnd";
import { usePublishedView } from "./use-published-view";

type TaskListProps = {
  columns: ProjectColumnRow[];
  /** Filtered and sorted tasks of the Columns that are loaded. */
  tasksByColumn: ReadonlyMap<string, TaskRow[]>;
  /** The Columns whose group is expanded. */
  expandedIds: ReadonlySet<string>;
  onToggle: (column: ProjectColumnRow) => void;
  /** Done and canceled groups that are expanded but still loading. */
  loadingColumnIds: ReadonlySet<string>;
  manualSort: boolean;
  archived: {
    tasks: TaskRow[];
    expanded: boolean;
    loading: boolean;
    onToggle: () => void;
  };
};

/**
 * One line of the list: a group header, a task, or the filler of a group that
 * is loading or empty. Every line has a fixed height, so the list can place
 * them without measuring.
 */
type Line =
  | {
      kind: "group";
      column: ProjectColumnRow;
      expanded: boolean;
      count: number | null;
    }
  | { kind: "loading"; key: string }
  | { kind: "task"; task: TaskRow; index: number; groupId: string }
  | { kind: "archived"; expanded: boolean; count: number | null }
  | { kind: "archivedEmpty" }
  | { kind: "archivedTask"; task: TaskRow };

const LINE_HEIGHT = { row: 36, loading: 48 } as const;

function heightOf(line: Line) {
  return line.kind === "loading" ? LINE_HEIGHT.loading : LINE_HEIGHT.row;
}

function keyOf(line: Line) {
  switch (line.kind) {
    case "group":
      return `group:${line.column.id}`;
    case "loading":
      return `loading:${line.key}`;
    case "task":
    case "archivedTask":
      return line.task.id;
    case "archived":
      return "archived";
    case "archivedEmpty":
      return "archived-empty";
  }
}

/**
 * The Project's tasks grouped by Column, in board order, with an Archived
 * group last. Only the lines in view are rendered, however many tasks a group
 * has; the list publishes its order so the keyboard can reach the rest.
 */
export function TaskList({
  columns,
  tasksByColumn,
  expandedIds,
  onToggle,
  loadingColumnIds,
  manualSort,
  archived,
}: TaskListProps) {
  const { t } = useTranslation("tasks");
  const actions = useTaskActions();
  const { project } = useTaskView();
  const scrollRef = useRef<HTMLDivElement>(null);

  const tasksById = useMemo(
    () =>
      new Map(
        [...tasksByColumn.values()].flat().map((task) => [task.id, task]),
      ),
    [tasksByColumn],
  );
  const lanes = useMemo<Lanes>(
    () =>
      Object.fromEntries(
        columns
          .filter((column) => expandedIds.has(column.id))
          .map((column) => [
            column.id,
            (tasksByColumn.get(column.id) ?? []).map((task) => task.id),
          ]),
      ),
    [columns, expandedIds, tasksByColumn],
  );
  const dnd = useLaneDnd({
    lanes,
    tasksById,
    manual: manualSort,
    enteringAt: "start",
    onDrop: (task, drop) =>
      void actions.drop(task, drop.columnId, drop.position),
  });

  const lines = useMemo(() => {
    const result: Line[] = [];
    for (const column of columns) {
      const expanded = expandedIds.has(column.id);
      const ids = dnd.lanes[column.id] ?? [];
      result.push({
        kind: "group",
        column,
        expanded,
        count: expanded ? (tasksByColumn.get(column.id) ?? []).length : null,
      });
      if (!expanded) continue;
      if (loadingColumnIds.has(column.id)) {
        result.push({ kind: "loading", key: column.id });
      }
      ids.forEach((id, index) => {
        const task = tasksById.get(id);
        if (task) {
          result.push({ kind: "task", task, index, groupId: column.id });
        }
      });
    }
    result.push({
      kind: "archived",
      expanded: archived.expanded,
      count:
        archived.expanded && !archived.loading ? archived.tasks.length : null,
    });
    if (archived.expanded) {
      if (archived.loading) result.push({ kind: "loading", key: "archived" });
      else if (archived.tasks.length === 0) {
        result.push({ kind: "archivedEmpty" });
      }
      for (const task of archived.tasks) {
        result.push({ kind: "archivedTask", task });
      }
    }
    return result;
  }, [
    archived,
    columns,
    dnd.lanes,
    expandedIds,
    loadingColumnIds,
    tasksById,
    tasksByColumn,
  ]);

  // The dragged row stays mounted even when it is scrolled out of view.
  const activeAt = dnd.activeId
    ? lines.findIndex(
        (line) => line.kind === "task" && line.task.id === dnd.activeId,
      )
    : -1;
  const virtualizer = useVirtualizer({
    count: lines.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (at) => heightOf(lines[at]!),
    getItemKey: (at) => keyOf(lines[at]!),
    overscan: 12,
    rangeExtractor: (range) => {
      const indexes = defaultRangeExtractor(range);
      if (activeAt === -1 || indexes.includes(activeAt)) return indexes;
      return [...indexes, activeAt].sort((a, b) => a - b);
    },
  });

  // The ticket column is as wide as the longest ticket id in the list, so the
  // status icon sits right after the id and the titles still line up.
  const ticketChars = useMemo(() => {
    let highest = 0;
    for (const line of lines) {
      if (
        (line.kind === "task" || line.kind === "archivedTask") &&
        line.task.number > highest
      ) {
        highest = line.task.number;
      }
    }
    return project.key.length + 1 + String(highest).length;
  }, [lines, project.key]);

  const shown = useMemo(
    () => lines.flatMap((line) => (line.kind === "task" ? [line.task] : [])),
    [lines],
  );
  const selectable = useMemo(
    () =>
      lines.flatMap((line) =>
        line.kind === "task" || line.kind === "archivedTask" ? [line.task] : [],
      ),
    [lines],
  );
  const view = useMemo(
    () => ({
      tasks: shown,
      selectable,
      lanes: null,
      reveal: (taskId: string) => {
        const at = lines.findIndex(
          (line) =>
            (line.kind === "task" || line.kind === "archivedTask") &&
            line.task.id === taskId,
        );
        if (at !== -1) virtualizer.scrollToIndex(at, { align: "auto" });
      },
    }),
    [lines, selectable, shown, virtualizer],
  );
  usePublishedView(view);

  return (
    <div
      ref={scrollRef}
      className="h-full overflow-y-auto overflow-x-hidden"
      style={{ "--ticket-chars": ticketChars } as CSSProperties}
    >
      <DragDropProvider {...dnd.providerProps}>
        <div
          className="relative w-full"
          style={{ height: virtualizer.getTotalSize() }}
        >
          {virtualizer.getVirtualItems().map((item) => {
            const line = lines[item.index]!;
            return (
              <div
                key={item.key}
                className="absolute inset-x-0 top-0"
                style={{
                  height: item.size,
                  transform: `translateY(${item.start}px)`,
                }}
              >
                {line.kind === "group" ? (
                  <ListGroupHeader
                    column={line.column}
                    expanded={line.expanded}
                    count={line.count}
                    onToggle={() => onToggle(line.column)}
                  />
                ) : line.kind === "task" ? (
                  <SortableTaskListRow
                    task={line.task}
                    index={line.index}
                    groupId={line.groupId}
                  />
                ) : line.kind === "archived" ? (
                  <ArchivedGroupHeader
                    expanded={line.expanded}
                    count={line.count}
                    onToggle={archived.onToggle}
                  />
                ) : line.kind === "archivedTask" ? (
                  <TaskListRow task={line.task} />
                ) : line.kind === "archivedEmpty" ? (
                  <p className="px-4 py-2.5 text-xs text-muted-foreground">
                    {t("list.archivedEmpty")}
                  </p>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Spinner />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <DragOverlay dropAnimation={null}>
          {(source) => {
            const task = tasksById.get(String(source.id));
            return task ? <TaskListRow task={task} lifted /> : null;
          }}
        </DragOverlay>
      </DragDropProvider>
    </div>
  );
}
