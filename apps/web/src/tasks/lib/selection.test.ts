import { describe, expect, it } from "vite-plus/test";
import {
  archiveAction,
  extendRange,
  labelState,
  overCap,
  prune,
  selectAll,
  toggle,
} from "./selection";

const ids = (set: ReadonlySet<string>) => [...set].sort();

describe("toggle", () => {
  it("adds and removes", () => {
    const one = toggle(new Set(), "a");
    expect(ids(one)).toEqual(["a"]);
    expect(ids(toggle(one, "a"))).toEqual([]);
  });
});

describe("extendRange", () => {
  it("covers the tasks between anchor and target in either direction", () => {
    const order = ["a", "b", "c", "d"];
    expect(ids(extendRange(new Set(), order, "b", "d"))).toEqual([
      "b",
      "c",
      "d",
    ]);
    expect(ids(extendRange(new Set(), order, "c", "a"))).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("stays in the order it is given, so a board column is not crossed", () => {
    const column = ["b1", "b2", "b3"];
    expect(ids(extendRange(new Set(["a1"]), column, "b1", "b3"))).toEqual([
      "a1",
      "b1",
      "b2",
      "b3",
    ]);
  });

  it("spans groups of the flat list order", () => {
    const flat = ["todo1", "todo2", "doing1", "doing2"];
    expect(ids(extendRange(new Set(), flat, "todo2", "doing1"))).toEqual([
      "doing1",
      "todo2",
    ]);
  });

  it("takes only the target without a usable anchor", () => {
    expect(ids(extendRange(new Set(), ["a", "b"], null, "b"))).toEqual(["b"]);
    expect(ids(extendRange(new Set(), ["a", "b"], "gone", "b"))).toEqual(["b"]);
  });
});

describe("selectAll and prune", () => {
  it("selects what is shown", () => {
    expect(ids(selectAll(["a", "b"]))).toEqual(["a", "b"]);
  });

  it("drops tasks that are no longer shown", () => {
    expect(ids(prune(new Set(["a", "b", "c"]), ["a", "c"]))).toEqual([
      "a",
      "c",
    ]);
  });

  it("returns the same set when nothing changed", () => {
    const selected = new Set(["a"]);
    expect(prune(selected, ["a", "b"])).toBe(selected);
  });
});

describe("overCap", () => {
  it("allows 200 and refuses 201", () => {
    expect(overCap(200)).toBe(false);
    expect(overCap(201)).toBe(true);
  });
});

describe("labelState", () => {
  it("tells all, some and none", () => {
    const tasks = [{ labelIds: ["x"] }, { labelIds: ["x", "y"] }];
    expect(labelState(tasks, "x")).toBe("all");
    expect(labelState(tasks, "y")).toBe("some");
    expect(labelState(tasks, "z")).toBe("none");
  });
});

describe("archiveAction", () => {
  const archived = { archivedAt: new Date() };
  const live = { archivedAt: null };
  it("unarchives only when every task is archived", () => {
    expect(archiveAction([archived, archived])).toBe("unarchive");
    expect(archiveAction([archived, live])).toBe("archive");
    expect(archiveAction([live])).toBe("archive");
  });
});
