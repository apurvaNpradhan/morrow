import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { TaskDescriptionEditor } from "./task-description-editor";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// jsdom has no layout: ProseMirror asks for the caret's rect when a command
// scrolls to it, so give it an empty one.
beforeAll(() => {
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => new DOMRect();
});

afterAll(() => {
  Reflect.deleteProperty(Range.prototype, "getClientRects");
  Reflect.deleteProperty(Range.prototype, "getBoundingClientRect");
});

afterEach(cleanup);

/** The last text node under `root`, where the caret of a typed run of text sits. */
function lastTextNode(root: Element) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let last: Text | null = null;
  while (walker.nextNode()) last = walker.currentNode as Text;
  return last!;
}

/**
 * Types `text` at the end of the editor, the way the browser edits a
 * contenteditable: the text grows and the caret follows it.
 */
async function typeAtEnd(container: HTMLElement, text: string) {
  await waitFor(() =>
    expect(container.querySelector(".ProseMirror")).not.toBeNull(),
  );
  const textNode = lastTextNode(container.querySelector(".ProseMirror")!);
  textNode.appendData(text);
  window
    .getSelection()!
    .setBaseAndExtent(textNode, textNode.length, textNode, textNode.length);
  return container.querySelector(".ProseMirror") as HTMLElement;
}

describe("TaskDescriptionEditor slash menu", () => {
  it("opens the blocks for /head and turns the block into a heading on click", async () => {
    const onChange = vi.fn();
    const { container } = render(
      <TaskDescriptionEditor
        label="Description"
        value="Intro"
        onChange={onChange}
      />,
    );
    await typeAtEnd(container, " /head");

    const listbox = await screen.findByRole("listbox", { name: "Blocks" });
    expect(
      within(listbox)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Heading 1", "Heading 2", "Heading 3"]);

    fireEvent.mouseDown(screen.getByRole("option", { name: "Heading 2" }));

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(
      container.querySelector(".ProseMirror h2")?.textContent?.trim(),
    ).toBe("Intro");
    expect(onChange.mock.calls.at(-1)![0].trim()).toBe("## Intro");
  });

  it("moves the selection with the arrow keys and picks it with Enter", async () => {
    const onChange = vi.fn();
    const { container } = render(
      <TaskDescriptionEditor
        label="Description"
        value="Intro"
        onChange={onChange}
      />,
    );
    const editor = await typeAtEnd(container, " /head");
    await screen.findByRole("listbox", { name: "Blocks" });

    fireEvent.keyDown(editor, { key: "ArrowDown" });
    fireEvent.keyDown(editor, { key: "ArrowDown" });
    expect(
      screen
        .getByRole("option", { name: "Heading 3" })
        .getAttribute("aria-selected"),
    ).toBe("true");
    fireEvent.keyDown(editor, { key: "Enter" });

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(
      container.querySelector(".ProseMirror h3")?.textContent?.trim(),
    ).toBe("Intro");
  });

  it("does not open the menu for a slash inside a code block", async () => {
    const onChange = vi.fn();
    const { container } = render(
      <TaskDescriptionEditor
        label="Description"
        value={"```ts\nconst answer = 42;\n```"}
        onChange={onChange}
      />,
    );
    await typeAtEnd(container, " /head");

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});
