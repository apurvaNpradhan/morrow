import { generateNKeysBetween } from "fractional-indexing";
import { describe, expect, it } from "vite-plus/test";
import { comparePosition } from "@morrow/sync-schemas";
import { positionForMove } from "./position-for-move";

const keys = generateNKeysBetween(null, null, 4);
const items = ["a", "b", "c", "d"].map((id, index) => ({
  id,
  position: keys[index]!,
}));

/** The order after giving `id` the position `positionForMove` returned. */
function orderAfter(id: string, toIndex: number) {
  const position = positionForMove(items, id, toIndex);
  if (position === null) return null;
  return items
    .map((item) => (item.id === id ? { ...item, position } : item))
    .sort(comparePosition)
    .map((item) => item.id);
}

describe("positionForMove", () => {
  it("moves an item to the front", () => {
    expect(orderAfter("c", 0)).toEqual(["c", "a", "b", "d"]);
  });

  it("moves an item to the end", () => {
    expect(orderAfter("a", 3)).toEqual(["b", "c", "d", "a"]);
  });

  it("moves an item up and down by one", () => {
    expect(orderAfter("c", 1)).toEqual(["a", "c", "b", "d"]);
    expect(orderAfter("b", 2)).toEqual(["a", "c", "b", "d"]);
  });

  it("has nothing to do when the item is already there", () => {
    expect(positionForMove(items, "b", 1)).toBeNull();
  });

  it("ignores an item that is not in the list", () => {
    expect(positionForMove(items, "zzz", 0)).toBeNull();
  });

  it("clamps an index past the end", () => {
    expect(orderAfter("a", 99)).toEqual(["b", "c", "d", "a"]);
  });

  it("handles a list of one and the first key of an empty neighbour", () => {
    expect(positionForMove([{ id: "only", position: "a0" }], "only", 0)).toBe(
      null,
    );
    const two = [
      { id: "x", position: "a0" },
      { id: "y", position: "a1" },
    ];
    expect(positionForMove(two, "y", 0)).toBe("Zz");
  });

  it("throws when the new neighbours share a position", () => {
    const clash = [
      { id: "a", position: "a0" },
      { id: "b", position: "a1" },
      { id: "c", position: "a1" },
    ];
    expect(() => positionForMove(clash, "a", 1)).toThrow();
  });
});
