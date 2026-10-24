import type { TaskRow } from "@morrow/sync-schemas";
import { expect, it } from "vite-plus/test";
import { arrangeSubTasks } from "./sub-tasks";

const columns = new Map([
  ["todo", { category: "unstarted" as const }],
  ["done", { category: "done" as const }],
]);

const task = (id: string, number: number, patch: Partial<TaskRow> = {}) =>
  ({
    id,
    number,
    columnId: "todo",
    archivedAt: null,
    priority: "none",
    position: "a0",
    createdAt: new Date(0),
    startAt: null,
    startHasTime: false,
    dueAt: null,
    dueHasTime: false,
    title: id,
    fieldValues: {},
    ...patch,
  }) as unknown as TaskRow;

const ids = (tasks: TaskRow[]) => tasks.map((candidate) => candidate.id);

it("orders by the chosen sort", () => {
  const tasks = [task("b", 2), task("a", 1), task("c", 3)];
  const view = {
    sort: { field: "number", direction: "desc" },
    completed: "all",
  } as const;
  expect(ids(arrangeSubTasks(tasks, columns, view, []))).toEqual([
    "c",
    "b",
    "a",
  ]);
});

it("leaves closed sub-tasks out when completed is none", () => {
  const tasks = [task("a", 1), task("b", 2, { columnId: "done" })];
  const base = { sort: { field: "number", direction: "asc" } } as const;
  expect(
    ids(arrangeSubTasks(tasks, columns, { ...base, completed: "all" }, [])),
  ).toEqual(["a", "b"]);
  expect(
    ids(arrangeSubTasks(tasks, columns, { ...base, completed: "none" }, [])),
  ).toEqual(["a"]);
});

it("never lists an archived sub-task", () => {
  const tasks = [task("a", 1, { archivedAt: new Date() })];
  const view = {
    sort: { field: "number", direction: "asc" },
    completed: "all",
  } as const;
  expect(arrangeSubTasks(tasks, columns, view, [])).toEqual([]);
});
