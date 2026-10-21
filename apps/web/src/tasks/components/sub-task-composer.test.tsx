import type { TaskRow } from "@morrow/sync-schemas";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { createTask } from "../actions/task-actions";
import { SubTaskComposer } from "./sub-task-composer";
import { type TaskViewValue, useTaskView } from "./task-view-context";

vi.mock("./task-view-context", () => ({ useTaskView: vi.fn() }));
vi.mock("../actions/task-actions", () => ({ createTask: vi.fn() }));
vi.mock("./task-description-editor", () => ({
  TaskDescriptionEditor: () => <div />,
}));
vi.mock("./draft-label-field", () => ({ DraftLabelField: () => <div /> }));

const parent = { id: "parent-1" } as TaskRow;
const todo = { id: "todo", category: "unstarted" };

beforeEach(() => {
  vi.mocked(createTask).mockResolvedValue({} as TaskRow);
  vi.mocked(useTaskView).mockReturnValue({
    project: { id: "p1", key: "MOR" },
    columns: [{ id: "started", category: "started" }, todo],
    people: [],
    meId: "me",
    today: "2026-10-15",
    can: { assign: true },
    workspace: { id: "w1", slug: "atlas" },
  } as unknown as TaskViewValue);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("creates the sub-task under the parent, in the first To Do column, and stays open", async () => {
  const onClose = vi.fn();
  render(<SubTaskComposer parent={parent} onClose={onClose} />);
  const title = screen.getByLabelText("subtasks.titleLabel");

  fireEvent.change(title, { target: { value: "  Ship it " } });
  fireEvent.submit(title.closest("form")!);

  await waitFor(() => expect(createTask).toHaveBeenCalledTimes(1));
  expect(createTask).toHaveBeenCalledWith(
    expect.objectContaining({
      projectId: "p1",
      column: todo,
      title: "Ship it",
      parentId: "parent-1",
      userId: "me",
    }),
  );
  await waitFor(() => expect((title as HTMLInputElement).value).toBe(""));
  expect(onClose).not.toHaveBeenCalled();
});

it("does not create without a title", () => {
  render(<SubTaskComposer parent={parent} onClose={vi.fn()} />);
  fireEvent.submit(screen.getByLabelText("subtasks.add"));
  expect(createTask).not.toHaveBeenCalled();
});

it("closes on Escape", () => {
  const onClose = vi.fn();
  render(<SubTaskComposer parent={parent} onClose={onClose} />);
  fireEvent.keyDown(screen.getByLabelText("subtasks.titleLabel"), {
    key: "Escape",
  });
  expect(onClose).toHaveBeenCalled();
});
