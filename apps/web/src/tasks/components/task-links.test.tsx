import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

const actions = vi.hoisted(() => ({
  addLink: vi.fn(),
  editLink: vi.fn(),
  removeLink: vi.fn(),
}));
const links = vi.hoisted(() => ({
  current: [] as Array<Record<string, unknown>>,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("../actions/link-actions", () => actions);
vi.mock("../queries/use-task-queries", () => ({
  useTaskLinks: () => links.current,
}));
vi.mock("./task-view-context", () => ({
  useTaskView: () => ({ can: { edit: true }, frozen: false }),
}));

import { TaskLinks } from "./task-links";

const task = { id: "t1", projectId: "p1" } as never;
const link = (over: Record<string, unknown>) => ({
  id: "l1",
  taskId: "t1",
  projectId: "p1",
  url: "https://www.github.com/acme/app/pull/7",
  title: null,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  ...over,
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  links.current = [];
});

describe("TaskLinks", () => {
  it("shows the title, the host and a favicon that falls back to a globe", () => {
    links.current = [link({ title: "PR 7" })];
    const { container } = render(<TaskLinks task={task} />);

    expect(screen.getByText("PR 7")).toBeTruthy();
    expect(screen.getByText("github.com")).toBeTruthy();
    const anchor = screen.getByRole("link");
    expect(anchor.getAttribute("rel")).toBe("noopener noreferrer");
    expect(anchor.getAttribute("target")).toBe("_blank");
    const icon = container.querySelector("img");
    expect(icon?.getAttribute("src")).toBe(
      "https://www.github.com/favicon.ico",
    );
    expect(icon?.getAttribute("referrerpolicy")).toBe("no-referrer");

    fireEvent.error(icon!);
    expect(screen.getByTestId("link-globe")).toBeTruthy();
  });

  it("adds a link, and refuses a non-http address", () => {
    render(<TaskLinks task={task} />);
    fireEvent.click(screen.getByRole("button", { name: "links.add" }));

    const url = screen.getByLabelText("links.url");
    fireEvent.change(url, { target: { value: "javascript:alert(1)" } });
    fireEvent.submit(url.closest("form")!);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(actions.addLink).not.toHaveBeenCalled();

    fireEvent.change(url, { target: { value: "https://example.com/a" } });
    fireEvent.change(screen.getByLabelText("links.titleLabel"), {
      target: { value: " Doc " },
    });
    fireEvent.submit(url.closest("form")!);
    expect(actions.addLink).toHaveBeenCalledWith(task, {
      url: "https://example.com/a",
      title: "Doc",
    });
  });

  it("does nothing for a URL the task already has", () => {
    links.current = [link({ url: "https://example.com/a" })];
    render(<TaskLinks task={task} />);
    fireEvent.click(screen.getByRole("button", { name: "links.add" }));
    const url = screen.getByLabelText("links.url");
    fireEvent.change(url, { target: { value: "https://example.com/a" } });
    fireEvent.submit(url.closest("form")!);
    expect(actions.addLink).not.toHaveBeenCalled();
  });

  it("edits and removes", () => {
    links.current = [link({ url: "https://example.com/a", title: "Old" })];
    render(<TaskLinks task={task} />);

    fireEvent.click(screen.getByRole("button", { name: "links.edit" }));
    fireEvent.change(screen.getByLabelText("links.titleLabel"), {
      target: { value: "New" },
    });
    fireEvent.submit(screen.getByLabelText("links.url").closest("form")!);
    expect(actions.editLink).toHaveBeenCalledWith("l1", {
      url: "https://example.com/a",
      title: "New",
    });

    fireEvent.click(screen.getByRole("button", { name: "links.remove" }));
    expect(actions.removeLink).toHaveBeenCalledWith("l1");
  });
});
