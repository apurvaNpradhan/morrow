import type {
  ProjectColumnRow,
  ProjectRow,
  TaskRow,
} from "@morrow/sync-schemas";
import { DragDropProvider, DragOverlay } from "@dnd-kit/react";
import { useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useDevicePreferences } from "@/app/preferences/use-device-preferences";
import { useTaskActions } from "../actions/use-task-actions";
import { BoardLane } from "./board-lane";
import { TaskCard } from "./task-card";
import { type Lanes, useLaneDnd } from "./use-lane-dnd";
import { usePublishedView } from "./use-published-view";

/**
 * The Project's Columns as lanes of cards, over the project background when
 * one is set and enabled on this device. `tasksByColumn` is already filtered
 * and sorted; `filtered` says whether an empty lane is empty because of that.
 */
export function TaskBoard({
  project,
  columns,
  tasksByColumn,
  expandedIds,
  onToggle,
  loadingColumnIds,
  manualSort,
  filtered,
}: {
  project: ProjectRow;
  columns: ProjectColumnRow[];
  tasksByColumn: ReadonlyMap<string, TaskRow[]>;
  /** The Columns whose lane is expanded. */
  expandedIds: ReadonlySet<string>;
  onToggle: (column: ProjectColumnRow) => void;
  /** Expanded lanes whose tasks are still loading. */
  loadingColumnIds: ReadonlySet<string>;
  manualSort: boolean;
  filtered: boolean;
}) {
  const { t } = useTranslation("tasks");
  const { showProjectBackgrounds } = useDevicePreferences();
  const actions = useTaskActions();
  const background = showProjectBackgrounds ? project.backgroundUrl : null;

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
    enteringAt: "end",
    onDrop: (task, drop) =>
      void actions.drop(task, drop.columnId, drop.position),
  });

  // Each lane scrolls its own cards; the board asks the lane of a task to
  // bring it into view, and its column into view across.
  const scrollers = useRef(new Map<string, ((index: number) => void) | null>());
  const registerScroll = useCallback(
    (columnId: string, scrollToIndex: ((index: number) => void) | null) => {
      scrollers.current.set(columnId, scrollToIndex);
    },
    [],
  );
  const view = useMemo(() => {
    const laneTasks = columns.map((column) =>
      expandedIds.has(column.id) ? (tasksByColumn.get(column.id) ?? []) : [],
    );
    return {
      tasks: laneTasks.flat(),
      lanes: laneTasks,
      reveal: (taskId: string) => {
        const at = columns.findIndex((_, lane) =>
          laneTasks[lane]!.some((task) => task.id === taskId),
        );
        if (at === -1) return;
        const column = columns[at]!;
        document
          .querySelector(`[data-lane="${column.id}"]`)
          ?.scrollIntoView({ block: "nearest", inline: "nearest" });
        scrollers.current.get(column.id)?.(
          laneTasks[at]!.findIndex((task) => task.id === taskId),
        );
      },
    };
  }, [columns, expandedIds, tasksByColumn]);
  usePublishedView(view);

  return (
    <div className="relative h-full min-h-96">
      {background ? (
        <>
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url("${background}")` }}
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-background/60 dark:bg-background/70"
          />
        </>
      ) : null}
      {/* The photo stays on the outer box; only the lanes scroll over it. */}
      <div className="relative h-full overflow-x-auto">
        <DragDropProvider {...dnd.providerProps}>
          <div
            aria-label={t("board.lanesLabel", { name: project.name })}
            className="relative flex h-full gap-3 p-4"
          >
            {columns.map((column) => {
              const ids = dnd.lanes[column.id] ?? [];
              return (
                <BoardLane
                  key={column.id}
                  column={column}
                  tasks={ids.flatMap((id) => tasksById.get(id) ?? [])}
                  expanded={expandedIds.has(column.id)}
                  loading={loadingColumnIds.has(column.id)}
                  onToggle={() => onToggle(column)}
                  activeId={dnd.activeId}
                  registerScroll={registerScroll}
                  empty={filtered ? t("board.emptyFiltered") : t("board.empty")}
                />
              );
            })}
          </div>
          <DragOverlay dropAnimation={null}>
            {(source) => {
              const task = tasksById.get(String(source.id));
              return task ? <TaskCard task={task} lifted /> : null;
            }}
          </DragOverlay>
        </DragDropProvider>
      </div>
    </div>
  );
}
