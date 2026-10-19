import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { TaskDescriptionEditor } from "./task-description-editor";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(cleanup);

describe("TaskDescriptionEditor loading", () => {
  it("reads as text before the editor is ready, then becomes editable", async () => {
    const { container } = render(
      <TaskDescriptionEditor
        label="Description"
        value="Ship the splash"
        onChange={vi.fn()}
      />,
    );

    // Straight after render the editor chunk has not resolved.
    expect(screen.getByText("Ship the splash")).toBeTruthy();
    expect(container.querySelector(".ProseMirror")).toBeNull();

    // The first import transforms Tiptap and is slow.
    await waitFor(
      () =>
        expect(
          container.querySelector('.ProseMirror[contenteditable="true"]'),
        ).not.toBeNull(),
      { timeout: 30_000 },
    );
    expect(screen.getByRole("textbox", { name: "Description" })).toBeTruthy();
  }, 60_000);
});
