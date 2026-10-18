import { cleanup, render, screen, waitFor } from "@testing-library/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

const lookups = vi.hoisted(() => ({
  current: {} as Record<string, unknown>,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("../queries/use-ticket-lookup", () => ({
  useTicketLookup: (_workspaceId: string | undefined, ticketId: string) =>
    lookups.current[ticketId],
}));

import { TaskDescriptionEditor } from "./task-description-editor";
import { TicketWorkspaceProvider } from "./ticket-workspace-context";

afterEach(() => {
  cleanup();
  lookups.current = {};
});

/** The editor needs a router for its links; the editor is the only route's component. */
function inRouter(ui: ReactNode) {
  const router = createRouter({
    routeTree: createRootRoute({ component: () => ui }),
    history: createMemoryHistory({ initialEntries: ["/acme"] }),
  });
  return <RouterProvider router={router} />;
}

/** The text of each paragraph in the editor, with the non-breaking spaces removed. */
async function paragraphsOf(container: HTMLElement) {
  await waitFor(() =>
    expect(container.querySelector(".ProseMirror")).not.toBeNull(),
  );
  return Array.from(container.querySelectorAll(".ProseMirror p")).map(
    (paragraph) => paragraph.textContent?.replace(/\u00a0/g, "") ?? "",
  );
}

const task = {
  id: "t1",
  number: 12,
  title: "Fix login",
  projectId: "p1",
  columnId: "c1",
  assigneeId: null,
};

describe("ticket references in the markdown editor", () => {
  it("saves the plain ticket id back unchanged", async () => {
    const onChange = vi.fn();
    const { container } = render(
      <TaskDescriptionEditor
        label="Description"
        value="see MOR-12 now"
        onChange={onChange}
      />,
    );
    expect(await paragraphsOf(container)).toEqual(["see MOR-12 now"]);

    // A real DOM edit after the reference, so the editor emits its markdown.
    const paragraph = container.querySelector(".ProseMirror p")!;
    paragraph.lastChild!.textContent = " now!";

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(onChange.mock.calls.at(-1)![0]).toBe("see MOR-12 now!");
  });

  it("keeps an id that names no task of the Workspace as plain text", async () => {
    const { container } = render(
      <TicketWorkspaceProvider id="w1" slug="acme">
        {inRouter(
          <TaskDescriptionEditor
            label="Description"
            value="see MOR-99 now"
            onChange={vi.fn()}
          />,
        )}
      </TicketWorkspaceProvider>,
    );

    expect(await paragraphsOf(container)).toEqual(["see MOR-99 now"]);
    expect(container.querySelector("a")).toBeNull();
  });

  it("keeps the id as plain text outside a Workspace, even when the task exists", async () => {
    lookups.current = { "MOR-12": { task, projectKey: "MOR" } };
    const { container } = render(
      inRouter(
        <TaskDescriptionEditor
          label="Description"
          value="see MOR-12 now"
          onChange={vi.fn()}
        />,
      ),
    );

    expect(await paragraphsOf(container)).toEqual(["see MOR-12 now"]);
    expect(container.querySelector("a")).toBeNull();
  });

  it("links an id that names a task of the Workspace, and still saves the plain id", async () => {
    lookups.current = { "MOR-12": { task, projectKey: "MOR" } };
    const onChange = vi.fn();
    const { container } = render(
      <TicketWorkspaceProvider id="w1" slug="acme">
        {inRouter(
          <TaskDescriptionEditor
            label="Description"
            value="see MOR-12 now"
            onChange={onChange}
          />,
        )}
      </TicketWorkspaceProvider>,
    );

    await paragraphsOf(container);
    const link = screen.getByRole("link", { name: "MOR-12" });
    expect(link.getAttribute("href")).toBe("/acme/tasks/MOR-12");

    container.querySelector(".ProseMirror p")!.lastChild!.textContent = " now!";
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(onChange.mock.calls.at(-1)![0]).toBe("see MOR-12 now!");
  });

  it("links a resolved reference in a read-only description too", async () => {
    lookups.current = { "MOR-12": { task, projectKey: "MOR" } };
    const { container } = render(
      <TicketWorkspaceProvider id="w1" slug="acme">
        {inRouter(
          <TaskDescriptionEditor
            label="Description"
            value="see MOR-12"
            editable={false}
            onChange={vi.fn()}
          />,
        )}
      </TicketWorkspaceProvider>,
    );

    await paragraphsOf(container);
    expect(screen.getByRole("link", { name: "MOR-12" })).toBeTruthy();
  });
});
