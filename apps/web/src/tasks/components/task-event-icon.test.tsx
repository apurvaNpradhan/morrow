import type { ProjectColumnRow, TaskEvent } from "@morrow/sync-schemas";
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { TaskEventIcon } from "./task-event-icon";
import { type TaskViewValue, useTaskView } from "./task-view-context";

vi.mock("./task-view-context", () => ({ useTaskView: vi.fn() }));

afterEach(cleanup);

const column = (
  id: string,
  category: ProjectColumnRow["category"],
): ProjectColumnRow =>
  ({ id, name: id, category, color: "#a1a1aa" }) as ProjectColumnRow;

const moveTo = (
  id: string,
  category: ProjectColumnRow["category"],
): TaskEvent => ({
  type: "column",
  data: {
    from: { id: "todo", name: "Todo", category: "unstarted" },
    to: { id, name: id, category },
  },
});

/** Only the fields the icon reads; the rest of the view is not rendered. */
function provideColumns(columns: ProjectColumnRow[]) {
  vi.mocked(useTaskView).mockReturnValue({
    columnById: new Map(columns.map((item) => [item.id, item])),
    statusFractions: new Map(),
  } as unknown as TaskViewValue);
}

it("draws a done Column's check", () => {
  provideColumns([column("shipped", "done")]);
  const { container } = render(
    <TaskEventIcon event={moveTo("shipped", "done")} />,
  );
  expect(container.querySelector("path")?.getAttribute("d")).toMatch(
    /^M7 0C3\.13401/,
  );
});

it("draws a canceled Column's cross", () => {
  provideColumns([column("dropped", "canceled")]);
  const { container } = render(
    <TaskEventIcon event={moveTo("dropped", "canceled")} />,
  );
  expect(container.querySelector("path")?.getAttribute("d")).toMatch(
    /^M7 14C10\.866/,
  );
});

it("falls back to a neutral circle when the target Column is gone", () => {
  provideColumns([]);
  const { container } = render(
    <TaskEventIcon event={moveTo("deleted", "done")} />,
  );
  expect(container.querySelector("path")).toBeNull();
  const svg = container.querySelector("svg");
  expect(svg?.classList.contains("lucide-circle")).toBe(true);
  expect(svg?.classList.contains("text-muted-foreground")).toBe(true);
});
