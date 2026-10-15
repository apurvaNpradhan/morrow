import { generateKeyBetween } from "fractional-indexing";

type Positioned = { id: string; position: string };

/**
 * The position that puts `movedId` at index `toIndex` of the list as it will
 * read after the move, between its new neighbours. `items` must be in order.
 * Returns null when the item is already there. Throws when its new neighbours
 * hold the same position (two people reordered at once); the caller tells the
 * user to try again.
 *
 * `all` is every item including ones `items` leaves out (archived projects
 * keep their position, and positions are unique across them). The new key is
 * taken between the previous visible item and whatever follows it in `all`,
 * so it can never land on a hidden item's position.
 */
export function positionForMove(
  items: ReadonlyArray<Positioned>,
  movedId: string,
  toIndex: number,
  all: ReadonlyArray<Positioned> = items,
): string | null {
  const from = items.findIndex((item) => item.id === movedId);
  if (from === -1 || from === toIndex) return null;
  const rest = items.filter((item) => item.id !== movedId);
  const index = Math.max(0, Math.min(toIndex, rest.length));
  const before = rest[index - 1];
  const everyoneElse = all.filter((item) => item.id !== movedId);
  const after = before
    ? everyoneElse[everyoneElse.findIndex((item) => item.id === before.id) + 1]
    : everyoneElse[0];
  return generateKeyBetween(before?.position ?? null, after?.position ?? null);
}
