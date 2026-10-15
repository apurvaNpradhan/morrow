import { describe, expect, it } from "vite-plus/test";
import { defaultDirection, sortTasks } from "./sort";

function task(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    number: Number(id.slice(1)),
    title: id,
    position: `a${id.slice(1)}`,
    priority: "none" as const,
    dueDate: null as string | null,
    createdAt: new Date(2026, 0, Number(id.slice(1))),
    ...overrides,
  };
}

const ids = (tasks: Array<{ id: string }>) => tasks.map((t) => t.id);

describe("sortTasks", () => {
  it("keeps board order for manual", () => {
    const tasks = [task("t3"), task("t1", { position: "Zz" }), task("t2")];
    expect(
      ids(sortTasks(tasks, { field: "manual", direction: "asc" })),
    ).toEqual(["t1", "t2", "t3"]);
  });

  it("sorts by priority strongest first when descending, ties by number", () => {
    const tasks = [
      task("t1", { priority: "low" }),
      task("t2", { priority: "urgent" }),
      task("t3", { priority: "low" }),
      task("t4", { priority: "none" }),
    ];
    expect(
      ids(sortTasks(tasks, { field: "priority", direction: "desc" })),
    ).toEqual(["t2", "t1", "t3", "t4"]);
    expect(
      ids(sortTasks(tasks, { field: "priority", direction: "asc" })),
    ).toEqual(["t4", "t1", "t3", "t2"]);
  });

  it("puts tasks without a due date last in both directions", () => {
    const tasks = [
      task("t1"),
      task("t2", { dueDate: "2026-12-01" }),
      task("t3", { dueDate: "2026-11-01" }),
    ];
    expect(
      ids(sortTasks(tasks, { field: "dueDate", direction: "asc" })),
    ).toEqual(["t3", "t2", "t1"]);
    expect(
      ids(sortTasks(tasks, { field: "dueDate", direction: "desc" })),
    ).toEqual(["t2", "t3", "t1"]);
  });

  it("sorts by created time, title and number in either direction", () => {
    const tasks = [
      task("t2", { title: "Bravo", createdAt: new Date(2026, 5, 1) }),
      task("t1", { title: "Alpha", createdAt: new Date(2026, 6, 1) }),
      task("t3", { title: "Charlie", createdAt: new Date(2026, 4, 1) }),
    ];
    expect(
      ids(sortTasks(tasks, { field: "created", direction: "asc" })),
    ).toEqual(["t3", "t2", "t1"]);
    expect(
      ids(sortTasks(tasks, { field: "title", direction: "desc" })),
    ).toEqual(["t3", "t2", "t1"]);
    expect(
      ids(sortTasks(tasks, { field: "number", direction: "desc" })),
    ).toEqual(["t3", "t2", "t1"]);
  });

  it("starts priority descending and everything else ascending", () => {
    expect(defaultDirection("priority")).toBe("desc");
    expect(defaultDirection("dueDate")).toBe("asc");
    expect(defaultDirection("title")).toBe("asc");
  });
});
