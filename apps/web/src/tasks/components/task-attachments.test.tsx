import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

const actions = vi.hoisted(() => ({ removeAttachment: vi.fn() }));
const files = vi.hoisted(() => ({
  current: [] as Array<Record<string, unknown>>,
}));
const view = vi.hoisted(() => ({
  can: { edit: true },
  frozen: false,
}));
const toast = vi.hoisted(() => ({ error: vi.fn() }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: { name?: string }) =>
      values?.name ? `${key}:${values.name}` : key,
  }),
}));
vi.mock("@/design-system/toast", () => ({ toast }));
vi.mock("../actions/attachment-actions", () => actions);
vi.mock("../queries/use-task-queries", () => ({
  useTaskAttachments: () => files.current,
}));
vi.mock("./task-view-context", () => ({
  useTaskView: () => ({
    ...view,
    personById: new Map([["u1", { id: "u1", name: "Ada Lovelace" }]]),
  }),
}));

import { TaskAttachments } from "./task-attachments";

const task = { id: "t1", projectId: "p1" } as never;
const file = (over: Record<string, unknown>) => ({
  id: "a1",
  workspaceId: "w1",
  taskId: "t1",
  filename: "report.pdf",
  mimeType: "application/pdf",
  size: 2457600,
  kind: "file",
  createdBy: "u1",
  createdAt: new Date(0),
  attachedAt: new Date(0),
  ...over,
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  files.current = [];
  view.can = { edit: true };
  view.frozen = false;
});

describe("TaskAttachments", () => {
  it("shows nothing for a task without files", () => {
    const { container } = render(<TaskAttachments task={task} />);

    expect(container.textContent).toBe("");
  });

  it("lists each file with its size and who added it", () => {
    files.current = [
      file({}),
      file({
        id: "a2",
        filename: "logs.zip",
        mimeType: "application/zip",
        size: 4096,
      }),
    ];
    render(<TaskAttachments task={task} />);

    expect(screen.getByText("report.pdf")).toBeTruthy();
    expect(screen.getByText(/2\.3 MB/)).toBeTruthy();
    expect(screen.getAllByText(/Ada Lovelace/)).toHaveLength(2);
    const zip = screen.getByRole("link", { name: /logs\.zip/ });
    expect(zip.getAttribute("href")).toBe("/api/asset/a2?download=1");
  });

  it("previews a viewable file in a frame instead of leaving the page", () => {
    files.current = [file({})];
    render(<TaskAttachments task={task} />);

    fireEvent.click(screen.getByRole("button", { name: /^report\.pdf/ }));

    const frame = document.body.querySelector("iframe");
    expect(frame?.getAttribute("src")).toBe("/api/asset/a1");
  });

  it("deletes only after the user confirms, warning that links will break", async () => {
    files.current = [file({})];
    actions.removeAttachment.mockResolvedValue(undefined);
    render(<TaskAttachments task={task} />);

    fireEvent.click(screen.getByLabelText("attachments.delete:report.pdf"));
    expect(actions.removeAttachment).not.toHaveBeenCalled();
    expect(screen.getByText("attachments.deleteWarning")).toBeTruthy();
    fireEvent.click(screen.getByText("attachments.deleteConfirm"));

    await waitFor(() =>
      expect(actions.removeAttachment).toHaveBeenCalledWith("a1"),
    );
  });

  it("says so when the delete is refused", async () => {
    files.current = [file({})];
    actions.removeAttachment.mockRejectedValue(new Error("nope"));
    render(<TaskAttachments task={task} />);

    fireEvent.click(screen.getByLabelText("attachments.delete:report.pdf"));
    fireEvent.click(screen.getByText("attachments.deleteConfirm"));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });

  it("offers no delete to someone who cannot edit, or on a frozen task", () => {
    files.current = [file({})];
    view.can = { edit: false };
    const { rerender } = render(<TaskAttachments task={task} />);
    expect(screen.queryByLabelText("attachments.delete:report.pdf")).toBeNull();

    view.can = { edit: true };
    view.frozen = true;
    rerender(<TaskAttachments task={task} />);
    expect(screen.queryByLabelText("attachments.delete:report.pdf")).toBeNull();
  });
});
