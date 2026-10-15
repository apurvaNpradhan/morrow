import { useState } from "react";
import { positionForMove } from "./position-for-move";

type Item = { id: string; position: string };

type SortableOptions<T extends Item> = {
  /** In their current order. */
  items: readonly T[];
  /** Every item in order, when `items` leaves some out. */
  allItems?: readonly T[];
  disabled?: boolean;
  /** Receives the item and the position computed from its new neighbours. */
  onMove: (item: T, position: string) => Promise<unknown>;
  onError: (error: unknown) => void;
};

/**
 * Reordering by drag and drop (native HTML5) or by the arrow keys on a handle,
 * for a list whose items hold fractional-index positions. Dropping on a row
 * takes that row's slot; only the moved item is written.
 */
export function useSortableList<T extends Item>({
  items,
  allItems,
  disabled = false,
  onMove,
  onError,
}: SortableOptions<T>) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  async function moveTo(id: string, toIndex: number) {
    const item = items.find((candidate) => candidate.id === id);
    if (!item) return;
    try {
      const position = positionForMove(items, id, toIndex, allItems);
      if (position !== null) await onMove(item, position);
    } catch (error) {
      onError(error);
    }
  }

  function reset() {
    setDraggingId(null);
    setOverId(null);
  }

  const draggingIndex = items.findIndex((item) => item.id === draggingId);

  return {
    /** Which edge of the hovered row the dragged item would land on. */
    dropIndicator(id: string): "top" | "bottom" | null {
      if (!draggingId || overId !== id || id === draggingId) return null;
      const overIndex = items.findIndex((item) => item.id === id);
      return draggingIndex < overIndex ? "bottom" : "top";
    },
    isDragging: (id: string) => draggingId === id,
    /** Spread on the row element. */
    rowProps(item: T, index: number) {
      if (disabled) return {};
      return {
        draggable: true,
        onDragStart(event: React.DragEvent) {
          event.dataTransfer.effectAllowed = "move";
          // Firefox starts a drag only when some data is set.
          event.dataTransfer.setData("text/plain", item.id);
          setDraggingId(item.id);
        },
        onDragOver(event: React.DragEvent) {
          if (!draggingId) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          setOverId(item.id);
        },
        onDrop(event: React.DragEvent) {
          event.preventDefault();
          const id = draggingId;
          reset();
          if (id) void moveTo(id, index);
        },
        onDragEnd: reset,
      };
    },
    /** Spread on the focusable drag handle: up and down arrows move the item. */
    handleProps(item: T, index: number) {
      if (disabled) return {};
      return {
        onKeyDown(event: React.KeyboardEvent) {
          const delta =
            event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
          if (!delta) return;
          event.preventDefault();
          if (index + delta < 0 || index + delta >= items.length) return;
          void moveTo(item.id, index + delta);
        },
      };
    },
  };
}
