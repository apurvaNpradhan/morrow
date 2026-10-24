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
    fieldValues: {} as Record<string, string | number | true | string[]>,
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

describe("sorting by a choice Field", () => {
  // Options in this order: Small, Medium, Large; their ids sort differently.
  const fields = [
    {
      id: "f1",
      options: [
        { id: "z-large", position: "a2" },
        { id: "a-small", position: "a0" },
        { id: "m-medium", position: "a1" },
      ],
    },
  ];
  const sized = (id: string, option?: string) =>
    task(id, { fieldValues: option ? { f1: option } : {} });
  const tasks = [
    sized("t1", "z-large"),
    sized("t2"),
    sized("t3", "a-small"),
    sized("t4", "m-medium"),
    sized("t5", "a-small"),
    sized("t6", "ghost"),
  ];

  it("follows the option order, not the ids or names, ties by number", () => {
    expect(
      ids(sortTasks(tasks, { field: "field:f1", direction: "asc" }, fields)),
    ).toEqual(["t3", "t5", "t4", "t1", "t2", "t6"]);
  });

  it("reverses the options but keeps tasks without a value last", () => {
    expect(
      ids(sortTasks(tasks, { field: "field:f1", direction: "desc" }, fields)),
    ).toEqual(["t1", "t4", "t3", "t5", "t2", "t6"]);
  });
});

describe("sorting by Fields of other types", () => {
  const withValue = (id: string, value?: string | number | true | string[]) =>
    task(id, { fieldValues: value === undefined ? {} : { f1: value } });
  const sort = (
    tasks: ReturnType<typeof task>[],
    type: string,
    direction: "asc" | "desc" = "asc",
    options: { id: string; position: string }[] = [],
  ) =>
    ids(
      sortTasks(tasks, { field: "field:f1", direction }, [
        { id: "f1", type, options },
      ]),
    );

  it("orders numbers by value, not as text, with unset last either way", () => {
    const tasks = [
      withValue("t1", 10),
      withValue("t2"),
      withValue("t3", 9),
      withValue("t4", -2),
      withValue("t5", 0),
    ];
    expect(sort(tasks, "number")).toEqual(["t4", "t5", "t3", "t1", "t2"]);
    expect(sort(tasks, "number", "desc")).toEqual([
      "t1",
      "t3",
      "t5",
      "t4",
      "t2",
    ]);
  });

  it("orders dates by day and texts alphabetically", () => {
    const dates = [
      withValue("t1", "2026-12-01"),
      withValue("t2", "2026-01-31"),
      withValue("t3"),
    ];
    expect(sort(dates, "date")).toEqual(["t2", "t1", "t3"]);
    const texts = [
      withValue("t1", "beta"),
      withValue("t2", "Alpha"),
      withValue("t3"),
    ];
    expect(sort(texts, "text")).toEqual(["t2", "t1", "t3"]);
  });

  it("puts checked boxes before unchecked ones when ascending", () => {
    const tasks = [withValue("t1"), withValue("t2", true)];
    expect(sort(tasks, "checkbox")).toEqual(["t2", "t1"]);
  });

  it("orders a multi choice by its first option in the Field's order", () => {
    const options = [
      { id: "a", position: "a0" },
      { id: "b", position: "a1" },
      { id: "c", position: "a2" },
    ];
    const tasks = [
      withValue("t1", ["c"]),
      withValue("t2", ["c", "a"]),
      withValue("t3", ["b"]),
      withValue("t4", ["ghost"]),
    ];
    expect(sort(tasks, "multi_choice", "asc", options)).toEqual([
      "t2",
      "t3",
      "t1",
      "t4",
    ]);
  });
});
