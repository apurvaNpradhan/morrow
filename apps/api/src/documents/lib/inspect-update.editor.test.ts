// @vitest-environment jsdom
import {
  BLOCK_ID_TYPES,
  documentExtensions,
  type WorkspaceRefs,
} from "@morrow/document-schema";
import { Editor } from "@tiptap/core";
import { Collaboration, isChangeOrigin } from "@tiptap/extension-collaboration";
import { ListKeymap } from "@tiptap/extension-list";
import { UniqueID } from "@tiptap/extension-unique-id";
import * as Y from "yjs";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { DOCUMENT_FRAGMENT } from "./empty-document";
import { inspectUpdate } from "./inspect-update";

/*
 * Drives a real Tiptap editor, set up like the web app's page editor
 * (`pageExtensions`), and holds every update the document emits to the write
 * check. What the editor library writes is the one thing the check cannot
 * know in advance, so this is what catches the next library change.
 */

const refs: WorkspaceRefs = {
  memberIds: new Set(["member1"]),
  documentIds: new Set(["page1"]),
};
const lookup = async () => refs;
const REMOTE = "test:remote";

// As in the web app: ids only for this client's own typing.
const BlockIdMinting = UniqueID.extend({
  onCreate() {
    this.storage.needsInitialIdGeneration = false;
  },
});

const text = (value: string, marks?: object[]) => ({
  type: "text",
  text: value,
  ...(marks && { marks }),
});
const paragraph = (...content: object[]) => ({ type: "paragraph", content });
const bullets = (...items: string[]) => ({
  type: "bulletList",
  content: items.map((item) => ({
    type: "listItem",
    content: [paragraph(text(item))],
  })),
});

type Session = { editor: Editor; doc: Y.Doc; updates: Uint8Array[] };
const editors: Editor[] = [];
afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy());
});

/** An editor bound to `doc`; `updates` collects what the user's own edits write. */
function open(doc = new Y.Doc(), content?: object[]): Session {
  const editor = new Editor({
    extensions: [
      ...documentExtensions,
      ListKeymap,
      Collaboration.configure({ document: doc, field: DOCUMENT_FRAGMENT }),
      BlockIdMinting.configure({
        attributeName: "blockId",
        types: BLOCK_ID_TYPES,
        generateID: () => crypto.randomUUID(),
        filterTransaction: (transaction) => !isChangeOrigin(transaction),
      }),
    ],
  });
  editors.push(editor);
  // A page that exists already: the server's first update, then the content.
  if (content) editor.commands.setContent({ type: "doc", content });
  const updates: Uint8Array[] = [];
  doc.on("update", (update: Uint8Array, origin: unknown) => {
    if (origin !== REMOTE) updates.push(update);
  });
  return { editor, doc, updates };
}

/** Every update must pass; reports the first that does not, with what was refused. */
async function expectAdmitted(updates: Uint8Array[]) {
  expect(updates.length).toBeGreaterThan(0);
  for (const update of updates) {
    const { problem } = await inspectUpdate(update, lookup);
    expect(problem).toBeNull();
  }
}

/** Runs a command that its extension declares (the typings of those are not loaded here). */
function run(editor: Editor, name: string, ...args: unknown[]) {
  const commands = editor.commands as unknown as Record<
    string,
    (...args: unknown[]) => boolean
  >;
  return commands[name]!(...args);
}

/** Selects the text of the `n`th textblock (0-based) from `from` to `to` inside it. */
function selectIn(editor: Editor, n: number, from: number, to = from) {
  let start = -1;
  let index = 0;
  editor.state.doc.descendants((node, pos) => {
    if (!node.isTextblock) return;
    if (index++ === n) start = pos + 1;
    return false;
  });
  editor.commands.setTextSelection({ from: start + from, to: start + to });
}

describe("inspectUpdate on what a real editor writes", () => {
  it("passes typing", async () => {
    const { editor, updates } = open();
    editor.commands.insertContent("Hello");
    editor.commands.insertContent(" world");

    await expectAdmitted(updates);
  });

  it("passes Enter in the middle of a paragraph", async () => {
    const { editor, updates } = open(undefined, [
      paragraph(text("Hello world")),
    ]);
    updates.length = 0;
    selectIn(editor, 0, 5);
    editor.commands.keyboardShortcut("Enter");

    await expectAdmitted(updates);
    expect(editor.state.doc.childCount).toBe(2);
  });

  it("passes Backspace at the start of a paragraph", async () => {
    const { editor, updates } = open(undefined, [
      paragraph(text("One")),
      paragraph(text("Two")),
    ]);
    updates.length = 0;
    selectIn(editor, 1, 0);
    editor.commands.keyboardShortcut("Backspace");

    await expectAdmitted(updates);
    expect(editor.state.doc.childCount).toBe(1);
  });

  it("passes Enter at the end of a list item, and Enter on an empty one to leave the list", async () => {
    const { editor, updates } = open(undefined, [bullets("one")]);
    updates.length = 0;
    selectIn(editor, 0, 3);
    editor.commands.keyboardShortcut("Enter");
    editor.commands.insertContent("two");
    editor.commands.keyboardShortcut("Enter");
    editor.commands.keyboardShortcut("Enter");

    await expectAdmitted(updates);
    expect(editor.state.doc.lastChild?.type.name).toBe("paragraph");
  });

  it("passes creating bullet, ordered and task lists", async () => {
    const { editor, updates } = open(undefined, [
      paragraph(text("a")),
      paragraph(text("b")),
      paragraph(text("c")),
    ]);
    updates.length = 0;
    selectIn(editor, 0, 0);
    run(editor, "toggleBulletList");
    selectIn(editor, 1, 0);
    run(editor, "toggleOrderedList");
    selectIn(editor, 2, 0);
    run(editor, "toggleTaskList");

    await expectAdmitted(updates);
  });

  it("passes toggling bold, italic and a link over a range", async () => {
    const { editor, updates } = open(undefined, [
      paragraph(text("Some words here")),
    ]);
    updates.length = 0;
    selectIn(editor, 0, 0, 9);
    run(editor, "toggleBold");
    selectIn(editor, 0, 5, 13);
    run(editor, "toggleItalic");
    selectIn(editor, 0, 2, 7);
    run(editor, "setLink", { href: "https://example.com" });
    selectIn(editor, 0, 3, 6);
    run(editor, "toggleBold");
    run(editor, "unsetLink");

    await expectAdmitted(updates);
  });

  it("passes setting a heading", async () => {
    const { editor, updates } = open(undefined, [paragraph(text("Title"))]);
    updates.length = 0;
    selectIn(editor, 0, 2);
    run(editor, "setHeading", { level: 2 });
    run(editor, "setParagraph");

    await expectAdmitted(updates);
  });

  it("passes inserting a code block", async () => {
    const { editor, updates } = open(undefined, [paragraph(text("x"))]);
    updates.length = 0;
    selectIn(editor, 0, 1);
    run(editor, "setCodeBlock", { language: "ts" });
    editor.commands.insertContent("const a = 1;");

    await expectAdmitted(updates);
  });

  it("passes a mention, a page link and an image", async () => {
    const { editor, updates } = open(undefined, [paragraph(text("See "))]);
    updates.length = 0;
    selectIn(editor, 0, 4);
    editor.commands.insertContent([
      { type: "mention", attrs: { id: "member1", label: "Ada" } },
      text(" "),
      { type: "pageLink", attrs: { docId: "page1", title: "Plan" } },
      { type: "assetImage", attrs: { src: "/api/asset/abc123", alt: "x" } },
      { type: "ticketReference", attrs: { ticketId: "MOR-12" } },
    ]);

    await expectAdmitted(updates);
  });

  it("passes deleting a selection that spans blocks", async () => {
    const { editor, updates } = open(undefined, [
      paragraph(text("First block")),
      bullets("a", "b"),
      paragraph(text("Last block")),
    ]);
    updates.length = 0;
    selectIn(editor, 0, 3);
    editor.commands.setTextSelection({
      from: editor.state.selection.from,
      to: editor.state.doc.content.size - 3,
    });
    editor.commands.deleteSelection();

    await expectAdmitted(updates);
  });

  it("passes deleting a thousand blocks at once, whose migration entry is over half a megabyte", async () => {
    const blocks = Array.from({ length: 1100 }, () => paragraph(text("line")));
    const { editor, updates } = open(undefined, blocks);
    updates.length = 0;
    editor.commands.selectAll();
    editor.commands.deleteSelection();

    await expectAdmitted(updates);
  });

  it("passes undo and redo", async () => {
    const { editor, updates } = open();
    editor.commands.insertContent("Hello");
    editor.commands.keyboardShortcut("Enter");
    editor.commands.insertContent("there");
    updates.length = 0;
    editor.commands.undo();
    editor.commands.undo();
    editor.commands.redo();

    await expectAdmitted(updates);
  });

  it("passes pasting several blocks", async () => {
    const { editor, updates } = open(undefined, [paragraph(text("Start"))]);
    updates.length = 0;
    selectIn(editor, 0, 5);
    editor.view.pasteHTML(
      "<h2>Pasted</h2><p>one <strong>two</strong></p><ul><li>a</li><li>b</li></ul><pre><code>x</code></pre>",
      new Event("paste") as ClipboardEvent,
    );

    await expectAdmitted(updates);
    expect(editor.state.doc.childCount).toBeGreaterThan(2);
  });

  it("passes two clients editing at once, and the merge", async () => {
    const a = open(undefined, [paragraph(text("Shared text"))]);
    const b = open(new Y.Doc());
    Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc), REMOTE);
    a.updates.length = 0;
    b.updates.length = 0;

    selectIn(a.editor, 0, 6);
    a.editor.commands.keyboardShortcut("Enter");
    selectIn(b.editor, 0, 0, 6);
    run(b.editor, "toggleBold");
    b.editor.commands.insertContent("x");

    Y.applyUpdate(a.doc, Y.encodeStateAsUpdate(b.doc), REMOTE);
    Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc), REMOTE);
    selectIn(a.editor, 0, 1);
    a.editor.commands.keyboardShortcut("Backspace");
    a.editor.commands.insertContent("y");
    Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc), REMOTE);

    await expectAdmitted(a.updates);
    await expectAdmitted(b.updates);
    expect(a.editor.getJSON()).toEqual(b.editor.getJSON());
  });
});
