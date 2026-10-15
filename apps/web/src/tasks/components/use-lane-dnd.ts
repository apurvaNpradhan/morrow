import type { TaskRow } from "@morrow/sync-schemas";
import {
  type DragDropProvider,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
} from "@dnd-kit/react";
import { move } from "@dnd-kit/helpers";
import { type ComponentProps, useRef, useState } from "react";
import { positionInLane, sameOrder } from "../lib/lane-position";

/** Lanes by Column id, each the ids of its tasks in the order shown. */
export type Lanes = Record<string, string[]>;

/** Where a dragged task landed: a Column, and a position unless the sort decides. */
export type LaneDrop = { columnId: string; position: string | null };

// Space picks a task up, so Enter can keep meaning "open it".
const KEYBOARD = KeyboardSensor.configure({
  keyboardCodes: {
    start: ["Space"],
    cancel: ["Escape"],
    end: ["Space", "Enter"],
    up: ["ArrowUp"],
    down: ["ArrowDown"],
    left: ["ArrowLeft"],
    right: ["ArrowRight"],
  },
});

/**
 * `move`, except for a task over a lane's own area rather than one of its
 * tasks (the padding, the gaps between cards, the edge). `move` then goes by
 * which half of the lane the pointer is in, which sends the task to the top
 * from anywhere in the upper half. Over its own lane nothing moves; over
 * another lane the task goes to the end of a board lane or, for a list group
 * (whose header is the target), the start.
 */
function moveOnLanes(
  lanes: Lanes,
  event: DragOverEvent | DragEndEvent,
  enteringAt: "start" | "end",
) {
  const sourceId = event.operation.source?.id;
  const targetId = event.operation.target?.id;
  if (
    typeof sourceId !== "string" ||
    typeof targetId !== "string" ||
    !(targetId in lanes)
  ) {
    return move(lanes, event);
  }
  const from = Object.keys(lanes).find((key) => lanes[key]?.includes(sourceId));
  if (from === undefined || from === targetId) return lanes;
  const target = lanes[targetId] ?? [];
  return {
    ...lanes,
    [from]: (lanes[from] ?? []).filter((id) => id !== sourceId),
    [targetId]:
      enteringAt === "end" ? [...target, sourceId] : [sourceId, ...target],
  };
}

/**
 * Drag and drop of tasks between and within lanes, for the board and the list.
 * While a task is dragged the lanes are previewed locally; on drop `onDrop`
 * gets its Column and, when the sort is manual, the position between its new
 * neighbours. Under another sort only the Column can change: the task goes to
 * the end of the lane it was dropped on.
 */
export function useLaneDnd({
  lanes,
  tasksById,
  manual,
  enteringAt,
  onDrop,
}: {
  lanes: Lanes;
  tasksById: ReadonlyMap<string, TaskRow>;
  manual: boolean;
  /** Where a task dropped on another lane's own area goes. */
  enteringAt: "start" | "end";
  onDrop: (task: TaskRow, drop: LaneDrop) => void;
}) {
  const [preview, setPreview] = useState<Lanes | null>(null);
  const previewRef = useRef<Lanes | null>(null);
  // The task being dragged: a virtualized view must keep its element mounted.
  const [activeId, setActiveId] = useState<string | null>(null);

  function show(next: Lanes | null) {
    previewRef.current = next;
    setPreview(next);
  }

  function columnOf(target: DragEndEvent["operation"]["target"]) {
    const columnId = (target?.data as { columnId?: string } | undefined)
      ?.columnId;
    return typeof columnId === "string" ? columnId : undefined;
  }

  const providerProps = {
    sensors: [PointerSensor, KEYBOARD],
    onDragStart: (event: DragStartEvent) => {
      const id = event.operation.source?.id;
      setActiveId(typeof id === "string" ? id : null);
      show(lanes);
    },
    onDragOver: (event: DragOverEvent) => {
      if (!manual) return;
      show(moveOnLanes(previewRef.current ?? lanes, event, enteringAt));
    },
    onDragEnd: (event: DragEndEvent) => {
      const shown = previewRef.current ?? lanes;
      setActiveId(null);
      show(null);
      if (event.canceled) return;
      const id = event.operation.source?.id;
      const task = typeof id === "string" ? tasksById.get(id) : undefined;
      if (!task) return;

      if (!manual) {
        const columnId = columnOf(event.operation.target);
        if (columnId && columnId !== task.columnId) {
          onDrop(task, { columnId, position: null });
        }
        return;
      }
      const landed = moveOnLanes(shown, event, enteringAt);
      const columnId = Object.keys(landed).find((key) =>
        landed[key]?.includes(task.id),
      );
      if (!columnId) return;
      const lane = landed[columnId] ?? [];
      if (
        columnId === task.columnId &&
        sameOrder(lane, lanes[columnId] ?? [])
      ) {
        return;
      }
      onDrop(task, {
        columnId,
        position: positionInLane(lane, task.id, tasksById),
      });
    },
  } satisfies Partial<ComponentProps<typeof DragDropProvider>>;

  return { lanes: preview ?? lanes, activeId, providerProps };
}
