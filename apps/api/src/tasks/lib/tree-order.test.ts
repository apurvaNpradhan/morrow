import { describe, expect, it } from "vite-plus/test";
import { treeOrder } from "./tree-order";

const task = (id: string, number: number, parentId: string | null = null) => ({
  id,
  number,
  parentId,
});

describe("treeOrder", () => {
  it("puts a parent before its subtree, depth first, children by number", () => {
    const tasks = [
      task("c2", 9, "p"),
      task("g", 12, "c1"),
      task("p", 5),
      task("c1", 7, "p"),
      task("solo", 2),
    ];
    expect(treeOrder(tasks, () => 0).map((t) => t.id)).toEqual([
      "solo",
      "p",
      "c1",
      "g",
      "c2",
    ]);
  });

  it("treats a task whose parent is not in the group as a root, ranked first", () => {
    const tasks = [task("a", 1), task("orphan", 3, "elsewhere")];
    const rank = (t: { id: string }) => (t.id === "orphan" ? 0 : 1);
    expect(treeOrder(tasks, rank).map((t) => t.id)).toEqual(["orphan", "a"]);
  });
});
