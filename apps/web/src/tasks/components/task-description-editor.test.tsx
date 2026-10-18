import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { TaskDescriptionEditor } from "./task-description-editor";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(cleanup);

/** The text of each paragraph in the editor, with the non-breaking spaces removed. */
async function paragraphsOf(container: HTMLElement) {
  await waitFor(() =>
    expect(container.querySelector(".ProseMirror")).not.toBeNull(),
  );
  return Array.from(container.querySelectorAll(".ProseMirror p")).map(
    (paragraph) => paragraph.textContent?.replace(/\u00a0/g, "") ?? "",
  );
}

describe("TaskDescriptionEditor blank paragraphs", () => {
  it("shows every blank paragraph of a stored description", async () => {
    // The markdown the editor saves for two blank paragraphs and a trailing one.
    const { container } = render(
      <TaskDescriptionEditor
        label="Description"
        value={"First\n\n\n\nSecond\n\n\n\n&nbsp;\n\nThird\n\n\n\n&nbsp;"}
        onChange={vi.fn()}
      />,
    );

    expect(await paragraphsOf(container)).toEqual([
      "First",
      "",
      "Second",
      "",
      "",
      "Third",
      "",
      "",
    ]);
  });

  it("saves the blank paragraphs after an edit and shows them again on reload", async () => {
    const onChange = vi.fn();
    const stored = "First\n\n\n\nSecond\n\n\n\n\n\nThird\n\n\n\n";
    const first = render(
      <TaskDescriptionEditor
        label="Description"
        value={stored}
        onChange={onChange}
      />,
    );
    await paragraphsOf(first.container);

    // A real DOM edit in the last text paragraph, so the editor emits its markdown.
    const third = Array.from(
      first.container.querySelectorAll(".ProseMirror p"),
    ).find((paragraph) => paragraph.textContent === "Third")!;
    third.firstChild!.textContent = "Third!";

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const saved = onChange.mock.calls.at(-1)![0] as string;
    first.unmount();

    const reloaded = render(
      <TaskDescriptionEditor
        label="Description"
        value={saved}
        onChange={vi.fn()}
      />,
    );
    expect(await paragraphsOf(reloaded.container)).toEqual([
      "First",
      "",
      "Second",
      "",
      "",
      "Third!",
      "",
      "",
    ]);
  });
});

describe("TaskDescriptionEditor tables and code blocks", () => {
  it("renders a GFM table and saves it back after an edit", async () => {
    const onChange = vi.fn();
    const { container } = render(
      <TaskDescriptionEditor
        label="Description"
        value={"| Name | Score |\n| --- | --- |\n| Ada | 1 |"}
        onChange={onChange}
      />,
    );
    await paragraphsOf(container);

    expect(container.querySelector("table")).not.toBeNull();
    expect(
      Array.from(container.querySelectorAll("th"), (cell) => cell.textContent),
    ).toEqual(["Name", "Score"]);
    expect(
      Array.from(container.querySelectorAll("td"), (cell) => cell.textContent),
    ).toEqual(["Ada", "1"]);

    const ada = Array.from(container.querySelectorAll("td")).find(
      (cell) => cell.textContent === "Ada",
    )!;
    ada.firstChild!.firstChild!.textContent = "Ada!";

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(onChange.mock.calls.at(-1)![0].trim()).toBe(
      "| Name | Score |\n| ---- | ----- |\n| Ada! | 1     |",
    );
  });

  it("renders a fenced ts block with highlighting and saves it as a fenced block", async () => {
    const onChange = vi.fn();
    const { container } = render(
      <TaskDescriptionEditor
        label="Description"
        value={"```ts\nconst answer: number = 42;\n```"}
        onChange={onChange}
      />,
    );
    await paragraphsOf(container);

    const code = container.querySelector(".ProseMirror pre code")!;
    expect(code.classList.contains("language-ts")).toBe(true);
    expect(code.querySelector(".hljs-keyword")?.textContent).toBe("const");
    expect(code.querySelector(".hljs-number")?.textContent).toBe("42");

    code.querySelector(".hljs-number")!.textContent = "43";

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(onChange.mock.calls.at(-1)![0].trim()).toBe(
      "```ts\nconst answer: number = 43;\n```",
    );
  });
});
