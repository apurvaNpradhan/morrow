import type {
  ProjectColumnRow,
  ProjectFieldRow,
  TaskRow,
} from "@morrow/sync-schemas";
import { describe, expect, it } from "vite-plus/test";
import { needsNoConfirmation, planMove } from "./move-plan";

const column = (
  id: string,
  name: string,
  category: ProjectColumnRow["category"],
) => ({ id, name, category }) as ProjectColumnRow;

const task = (id: string, number: number, patch: Partial<TaskRow> = {}) =>
  ({
    id,
    number,
    columnId: "s-todo",
    parentId: null,
    fieldValues: {},
    ...patch,
  }) as unknown as TaskRow;

const field = (patch: Partial<ProjectFieldRow>) =>
  ({ type: "text", options: [], ...patch }) as unknown as ProjectFieldRow;

const from = {
  key: "MOR",
  columns: [
    column("s-todo", "To Do", "unstarted"),
    column("s-doing", "Doing", "started"),
    column("s-done", "Done", "done"),
  ],
  fields: [field({ id: "f-note", name: "Note" })],
};
const to = {
  key: "WEB",
  columns: [
    column("d-todo", "To Do", "unstarted"),
    column("d-wip", "In Progress", "started"),
    column("d-done", "Done", "done"),
  ],
  fields: [],
};

describe("planMove", () => {
  it("lands each Task in the Column with its name, else its category", () => {
    const plan = planMove({
      selected: [task("a", 1), task("b", 2, { columnId: "s-doing" })],
      projectTasks: [],
      withSubtasks: true,
      from,
      to,
    });

    expect(plan.columnOf.get("a")?.id).toBe("d-todo");
    expect(plan.columnOf.get("b")?.id).toBe("d-wip");
    // "Doing" had no namesake: not exact.
    expect(plan.exact).toBe(false);
  });

  it("puts the selected Tasks in the picked Column and their Subtasks by their own state", () => {
    const parent = task("p", 1);
    const child = task("c", 2, { parentId: "p", columnId: "s-done" });
    const plan = planMove({
      selected: [parent],
      projectTasks: [parent, child],
      withSubtasks: true,
      from,
      to,
      columnId: "d-done",
    });

    expect(plan.tasks.map((t) => t.id)).toEqual(["p", "c"]);
    expect(plan.columnOf.get("p")?.id).toBe("d-done");
    expect(plan.columnOf.get("c")?.id).toBe("d-done");
    expect(plan.hasSubtasks).toBe(true);
  });

  it("takes only the selected Tasks without Subtasks, and walks a deep tree with them", () => {
    const a = task("a", 1);
    const b = task("b", 2, { parentId: "a" });
    const c = task("c", 3, { parentId: "b" });
    const input = { selected: [a], projectTasks: [a, b, c], from, to };

    expect(planMove({ ...input, withSubtasks: false }).tasks).toHaveLength(1);
    expect(planMove({ ...input, withSubtasks: true }).tasks).toHaveLength(3);
  });

  it("counts a Task selected with its Parent once", () => {
    const a = task("a", 1);
    const b = task("b", 2, { parentId: "a" });

    const plan = planMove({
      selected: [b, a],
      projectTasks: [a, b],
      withSubtasks: true,
      from,
      to,
    });

    expect(plan.tasks).toHaveLength(2);
  });

  it("lists the Field values the destination cannot hold, by ticket id", () => {
    const plan = planMove({
      selected: [task("a", 7, { fieldValues: { "f-note": "hello" } })],
      projectTasks: [],
      withSubtasks: true,
      from,
      to,
    });

    expect(plan.dropped).toEqual([
      { ticketId: "MOR-7", field: "Note", value: "hello" },
    ]);
  });
});

describe("needsNoConfirmation", () => {
  const plan = (patch = {}) =>
    planMove({
      selected: [task("a", 1)],
      projectTasks: [],
      withSubtasks: true,
      from,
      to,
      ...patch,
    });

  it("skips the question for one exact Task with nothing to lose", () => {
    expect(needsNoConfirmation(plan(), 1)).toBe(true);
  });

  it("asks when a value would be lost, a Column does not match or it is a bulk move", () => {
    const lossy = plan({
      selected: [task("a", 1, { fieldValues: { "f-note": "x" } })],
    });
    const inexact = plan({ selected: [task("a", 1, { columnId: "s-doing" })] });

    expect(needsNoConfirmation(lossy, 1)).toBe(false);
    expect(needsNoConfirmation(inexact, 1)).toBe(false);
    expect(needsNoConfirmation(plan(), 2)).toBe(false);
  });

  it("asks when the Task has Subtasks", () => {
    const parent = task("p", 1);
    const child = task("c", 2, { parentId: "p" });
    const withChild = plan({
      selected: [parent],
      projectTasks: [parent, child],
    });

    expect(needsNoConfirmation(withChild, 1)).toBe(false);
  });
});
