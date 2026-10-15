import { generateKeyBetween } from "fractional-indexing";

type Positioned = { id: string; position: string };

/**
 * The position that puts `movedId` where it now stands in `laneIds` (the lane
 * as the user sees it after the drop), between its two visible neighbours.
 * Archived tasks the lane does not show may hold the slot; the server then
 * places the task right after them, still between these neighbours.
 */
export function positionInLane(
  laneIds: readonly string[],
  movedId: string,
  tasksById: ReadonlyMap<string, Positioned>,
): string {
  const index = laneIds.indexOf(movedId);
  if (index === -1) throw new Error("The task is not in the lane");
  const before = laneIds[index - 1];
  const after = laneIds[index + 1];
  return generateKeyBetween(
    before ? (tasksById.get(before)?.position ?? null) : null,
    after ? (tasksById.get(after)?.position ?? null) : null,
  );
}

/** Whether a lane reads the same before and after a drag. */
export function sameOrder(a: readonly string[], b: readonly string[]) {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}
