import type { TaskRow } from "@morrow/sync-schemas";
import { describe, expect, it } from "vite-plus/test";
import { arrowTarget } from "./arrow-navigation";

const task = (id: string) => ({ id }) as TaskRow;
const [a1, a2, c1] = [task("a1"), task("a2"), task("c1")];

describe("arrowTarget in the list", () => {
  const view = { tasks: [a1, a2, c1], lanes: null };

  it("walks the rows with up and down and stops at the ends", () => {
    expect(arrowTarget(view, "ArrowDown", "a1")).toBe(a2);
    expect(arrowTarget(view, "ArrowDown", "a2")).toBe(c1);
    expect(arrowTarget(view, "ArrowDown", "c1")).toBeUndefined();
    expect(arrowTarget(view, "ArrowUp", "a1")).toBeUndefined();
  });

  it("ignores left, right and other keys", () => {
    expect(arrowTarget(view, "ArrowRight", "a1")).toBeUndefined();
    expect(arrowTarget(view, "Enter", "a1")).toBeUndefined();
  });
});

describe("arrowTarget on the board", () => {
  const view = { tasks: [a1, a2, c1], lanes: [[a1, a2], [], [c1]] };

  it("walks a lane with up and down and stops at its ends", () => {
    expect(arrowTarget(view, "ArrowDown", "a1")).toBe(a2);
    expect(arrowTarget(view, "ArrowDown", "a2")).toBeUndefined();
    expect(arrowTarget(view, "ArrowUp", "a2")).toBe(a1);
    expect(arrowTarget(view, "ArrowUp", "a1")).toBeUndefined();
  });

  it("crosses to the next lane that has tasks, at the same height or its last card", () => {
    expect(arrowTarget(view, "ArrowRight", "a2")).toBe(c1);
    expect(arrowTarget(view, "ArrowRight", "c1")).toBeUndefined();
    expect(arrowTarget(view, "ArrowLeft", "c1")).toBe(a1);
  });

  it("knows nothing about a task that is not shown", () => {
    expect(arrowTarget(view, "ArrowDown", "zzz")).toBeUndefined();
  });
});
