import { getDocumentSchema } from "@morrow/document-schema";
import { Editor } from "@tiptap/react";
import { prosemirrorJSONToYDoc } from "@tiptap/y-tiptap";
import * as Y from "yjs";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { DOCUMENT_FRAGMENT, pageExtensions } from "./page-extensions";

const BLOCK_ID = "0b8f6a52-6f2e-4a52-9c43-0d3f5a1a7f10";

/** A page as the server creates it, with or without the block id of its paragraph. */
function pageDoc(withBlockId: boolean) {
  const attrs = withBlockId ? { blockId: BLOCK_ID } : {};
  return prosemirrorJSONToYDoc(
    getDocumentSchema(),
    { type: "doc", content: [{ type: "paragraph", attrs }] },
    DOCUMENT_FRAGMENT,
  );
}

const editors: Editor[] = [];

function open(doc: Y.Doc, editable: boolean) {
  const updates: Uint8Array[] = [];
  doc.on("update", (update: Uint8Array) => updates.push(update));
  const editor = new Editor({
    element: document.createElement("div"),
    extensions: pageExtensions(doc, "", () => editable),
    editable,
  });
  editors.push(editor);
  return { editor, updates };
}

afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy());
});

/** A change another client made to a copy of the page. */
function remoteEdit(doc: Y.Doc) {
  const remote = new Y.Doc();
  Y.applyUpdate(remote, Y.encodeStateAsUpdate(doc));
  const before = Y.encodeStateVector(remote);
  remote
    .getXmlFragment(DOCUMENT_FRAGMENT)
    .insert(1, [new Y.XmlElement("paragraph")]);
  return Y.encodeStateAsUpdate(remote, before);
}

describe("the page editor's plugins", () => {
  it("lists every plugin that may write on its own", () => {
    const { editor } = open(pageDoc(true), true);
    const writers = editor.state.plugins
      .filter((plugin) => plugin.spec.appendTransaction)
      // Plugins without a key are numbered in the order they were made.
      .map((plugin) =>
        (plugin as unknown as { key: string }).key.replace(
          /^plugin\$\d+$/,
          "plugin$",
        ),
      )
      .sort();
    // A new entry needs a check that it cannot fire on opening, on a remote
    // update or in a reader; the tests below are where that is shown.
    expect(writers).toEqual([
      "autolink$",
      "clearDocument$",
      "detailsSelection$",
      "plugin$",
      "plugin$",
      "plugin$",
      "plugin$",
      "plugin$",
      "plugin$",
      "plugin$",
      "selectingCells$",
      "uniqueID$",
    ]);
  });

  it("emit no update when a page is opened, even one whose blocks have no ids", () => {
    const { updates } = open(pageDoc(false), true);
    expect(updates).toHaveLength(0);
  });

  it("emit no update when a remote update arrives", () => {
    const doc = pageDoc(true);
    const { updates } = open(doc, true);
    Y.applyUpdate(doc, remoteEdit(doc), "server");
    expect(updates).toHaveLength(1);
    // The one update is the remote one itself; nothing was written in reply.
    expect(
      Y.decodeUpdate(updates[0]!).structs.every(
        (s) => s.id.client !== doc.clientID,
      ),
    ).toBe(true);
  });

  it("emit no update in a reader, whatever arrives", () => {
    const doc = pageDoc(false);
    const { updates } = open(doc, false);
    Y.applyUpdate(doc, remoteEdit(doc), "server");
    const own = updates.filter((update) =>
      Y.decodeUpdate(update).structs.some((s) => s.id.client === doc.clientID),
    );
    expect(own).toHaveLength(0);
  });

  it("give a block the user creates an id", () => {
    const { editor, updates } = open(pageDoc(true), true);
    editor.commands.focus("end");
    editor.commands.splitBlock();
    editor.commands.insertContent("second");
    expect(updates.length).toBeGreaterThan(0);
    const ids = editor
      .getJSON()
      .content?.map((block) => block.attrs?.blockId as string);
    expect(ids).toHaveLength(2);
    expect(ids).toContain(BLOCK_ID);
    expect(new Set(ids).size).toBe(2);
    expect(ids?.every((id) => /^[0-9a-f-]{36}$/.test(id))).toBe(true);
  });
});
