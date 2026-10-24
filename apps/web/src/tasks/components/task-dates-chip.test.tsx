import type { TaskRow } from "@morrow/sync-schemas";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vite-plus/test";
import { TaskDatesChip } from "./task-dates-chip";

afterEach(cleanup);

type Dates = Pick<TaskRow, "startAt" | "startHasTime" | "dueAt" | "dueHasTime">;
const none: Dates = {
  startAt: null,
  startHasTime: false,
  dueAt: null,
  dueHasTime: false,
};
const task = (dates: Partial<Dates>) =>
  ({ ...none, completedAt: null, ...dates }) as unknown as TaskRow;
const day = (text: string) => new Date(`${text}T00:00:00Z`);

function chip(row: TaskRow, today = "2026-10-15") {
  render(
    <TaskDatesChip
      task={row}
      showStart
      showDue
      today={today}
      timeZone="UTC"
      open={undefined}
    />,
  );
}

it("shows a start and a due date as one range", () => {
  chip(task({ startAt: day("2026-10-20"), dueAt: day("2026-10-24") }));
  expect(screen.getByText("Oct 20 → Oct 24")).toBeInTheDocument();
});

it("adds the time of a moment, read in the user's zone", () => {
  chip(
    task({
      startAt: new Date("2026-10-20T09:30:00Z"),
      startHasTime: true,
      dueAt: day("2026-10-24"),
    }),
  );
  expect(screen.getByText(/Oct 20, 9:30\s?AM → Oct 24/)).toBeInTheDocument();
});

it("shows the due date alone in words, and a start alone as 'starts'", () => {
  chip(task({ dueAt: day("2026-10-16") }));
  expect(screen.getByText("due.tomorrow")).toBeInTheDocument();
  cleanup();
  chip(task({ startAt: day("2026-10-20") }));
  expect(screen.getByText("card.starts")).toBeInTheDocument();
});

it("turns red once the due date has passed", () => {
  chip(task({ startAt: day("2026-10-01"), dueAt: day("2026-10-10") }));
  expect(screen.getByTitle(/fields.startDate/)).toHaveClass("text-red-600");
});

it("renders nothing without a date", () => {
  const { container } = render(
    <TaskDatesChip
      task={task({})}
      showStart
      showDue
      today="2026-10-15"
      timeZone="UTC"
      open={undefined}
    />,
  );
  expect(container).toBeEmptyDOMElement();
});
