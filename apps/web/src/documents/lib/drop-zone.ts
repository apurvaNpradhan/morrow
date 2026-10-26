import type { DropZone } from "./document-tree";

/**
 * Which part of a row the pointer is over: the top quarter drops before it,
 * the bottom quarter after it, and the middle makes the dragged page a child.
 */
export function dropZoneAt(
  pointerY: number,
  row: { top: number; height: number },
): DropZone {
  const offset = (pointerY - row.top) / row.height;
  if (offset < 0.25) return "before";
  if (offset > 0.75) return "after";
  return "inside";
}
