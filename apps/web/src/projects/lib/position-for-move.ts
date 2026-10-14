import { generateKeyBetween } from "fractional-indexing";

/**
 * The position that puts `movedId` at index `toIndex` of the list as it will
 * read after the move, between its new neighbours. `items` must be in order.
 * Returns null when the item is already there. Throws when its new neighbours
 * hold the same position (two people reordered at once); the caller tells the
 * user to try again.
 */
export function positionForMove(
  items: ReadonlyArray<{ id: string; position: string }>,
  movedId: string,
  toIndex: number,
): string | null {
  const from = items.findIndex((item) => item.id === movedId);
  if (from === -1 || from === toIndex) return null;
  const rest = items.filter((item) => item.id !== movedId);
  const index = Math.max(0, Math.min(toIndex, rest.length));
  return generateKeyBetween(
    rest[index - 1]?.position ?? null,
    rest[index]?.position ?? null,
  );
}
