import { createId } from "@paralleldrive/cuid2";
import { Plugin, Selection } from "@tiptap/pm/state";
import { Extension, type Editor } from "@tiptap/react";
import type { UploadedAsset } from "@morrow/document-schema";
import { assetPath } from "@morrow/document-schema";
import {
  createPlaceholderElement,
  placeholders,
  uploadPlaceholders,
} from "./upload-placeholders";

/** What the editor needs from the app to upload: how, how to tell the user, and what to call it. */
export type UploadHandlers = {
  upload: (
    file: File,
    onProgress: (fraction: number) => void,
  ) => Promise<UploadedAsset>;
  onError: (file: File, error: unknown) => void;
  /** The accessible name of a placeholder. */
  label: (filename: string) => string;
};

type UploadState = {
  handlers: UploadHandlers | null;
  running: number;
  onBusyChange?: (running: number) => void;
};

const states = new WeakMap<Editor, UploadState>();

/** The upload state of one editor; it goes with the editor. */
function stateOf(editor: Editor) {
  let state = states.get(editor);
  if (!state) {
    state = { handlers: null, running: 0 };
    states.set(editor, state);
  }
  return state;
}

/** Who hears how many uploads are running, so a comment is not posted before its files are in. */
export function setBusyListener(
  editor: Editor,
  listener: ((running: number) => void) | undefined,
) {
  stateOf(editor).onBusyChange = listener;
}

/** Tells the editor how to upload, or that it cannot (null). */
export function setUploadHandlers(
  editor: Editor,
  handlers: UploadHandlers | null,
) {
  stateOf(editor).handlers = handlers;
}

/** Whether this editor can take files: the app gave it a way to upload. */
export function canUpload(editor: Editor) {
  return editor.isEditable && stateOf(editor).handlers !== null;
}

/**
 * The transaction that puts a block where a placeholder was: between blocks it
 * goes in place, in an empty paragraph it replaces it, and in a filled one it
 * follows it. A block at the very end is followed by an empty paragraph so the
 * cursor has somewhere to go.
 */
function insertBlock(
  editor: Editor,
  pos: number,
  block: Parameters<Editor["schema"]["nodeFromJSON"]>[0],
) {
  const { state } = editor;
  const node = state.schema.nodeFromJSON(block);
  const $pos = state.doc.resolve(pos);
  const tr = state.tr;
  const empty = state.schema.nodes.paragraph!.create();
  if ($pos.depth === 0) {
    tr.insert(pos, pos >= state.doc.content.size ? [node, empty] : node);
  } else if ($pos.parent.isTextblock && $pos.parent.content.size === 0) {
    const atEnd = $pos.after() >= state.doc.content.size;
    tr.replaceWith($pos.before(), $pos.after(), atEnd ? [node, empty] : node);
  } else {
    // After the cards already below this paragraph, so files that finish
    // together keep the order they were added in.
    let at = $pos.after();
    while (state.doc.nodeAt(at)?.type.name === "attachmentCard") {
      at += state.doc.nodeAt(at)!.nodeSize;
    }
    tr.insert(at, at >= state.doc.content.size ? [node, empty] : node);
  }
  return tr;
}

function finish(editor: Editor, id: string, asset: UploadedAsset) {
  const pos = placeholders.find(editor.state, id);
  if (pos === null) return;
  if (asset.kind === "image") {
    // An image sits in text; between blocks it goes to the nearest paragraph.
    const $pos = editor.state.doc.resolve(pos);
    const at = $pos.parent.inlineContent ? pos : Selection.near($pos).from;
    const tr = editor.state.tr.insert(
      at,
      editor.schema.nodes.assetImage!.create({
        src: `${assetPath(asset.id)}${asset.width && asset.height ? `?w=${asset.width}&h=${asset.height}` : ""}`,
        alt: asset.filename,
      }),
    );
    editor.view.dispatch(tr.setMeta(placeholders.key, placeholders.remove(id)));
    return;
  }
  const tr = insertBlock(editor, pos, {
    type: "attachmentCard",
    attrs: {
      id: asset.id,
      filename: asset.filename,
      mimeType: asset.mimeType,
      size: asset.size,
    },
  });
  editor.view.dispatch(tr.setMeta(placeholders.key, placeholders.remove(id)));
}

function setRunning(editor: Editor, change: number) {
  const state = stateOf(editor);
  state.running += change;
  state.onBusyChange?.(state.running);
}

/** Uploads one file and, when it is in, puts it where its placeholder is. */
export function uploadFile(editor: Editor, file: File, pos: number) {
  const handlers = stateOf(editor).handlers;
  if (!handlers) return;
  const id = createId();
  const { element, setProgress } = createPlaceholderElement(
    file.name,
    handlers.label(file.name),
  );
  editor.view.dispatch(
    editor.state.tr.setMeta(
      placeholders.key,
      placeholders.add(id, pos, element),
    ),
  );
  setRunning(editor, 1);
  handlers
    .upload(file, setProgress)
    .then((asset) => {
      if (!editor.isDestroyed) finish(editor, id, asset);
    })
    .catch((error: unknown) => {
      if (!editor.isDestroyed) {
        editor.view.dispatch(
          editor.state.tr.setMeta(placeholders.key, placeholders.remove(id)),
        );
      }
      handlers.onError(file, error);
    })
    .finally(() => {
      if (!editor.isDestroyed) setRunning(editor, -1);
    });
}

export function uploadFiles(editor: Editor, files: File[], pos: number) {
  for (const file of files) uploadFile(editor, file, pos);
}

/** Opens the system file picker; whatever is chosen uploads at the cursor. */
export function pickFiles(editor: Editor) {
  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;
  input.onchange = () => {
    const files = Array.from(input.files ?? []);
    if (files.length > 0 && !editor.isDestroyed) {
      uploadFiles(editor, files, editor.state.selection.to);
    }
  };
  input.click();
}

function textOf(data: DataTransfer | null) {
  return (
    (data?.getData("text/plain") ?? "") + (data?.getData("text/html") ?? "")
  );
}

/**
 * Files into the editor: paste, drop, the picker and the slash command all end
 * in `uploadFile`. A paste that also carries text (a spreadsheet copies its
 * cells as text and as a picture) stays a text paste.
 */
export const AttachmentUploads = Extension.create({
  name: "attachmentUploads",

  addProseMirrorPlugins() {
    return [uploadPlaceholders(), filePlugin(this.editor)];
  },
});

function filePlugin(editor: Editor) {
  return new Plugin({
    props: {
      handlePaste(_view, event) {
        if (!canUpload(editor)) return false;
        const data = event.clipboardData;
        const files = Array.from(data?.files ?? []);
        if (files.length === 0 || textOf(data).trim() !== "") return false;
        event.preventDefault();
        uploadFiles(editor, files, editor.state.selection.to);
        return true;
      },
      handleDrop(view, event, _slice, moved) {
        if (moved || !canUpload(editor)) return false;
        const files = Array.from(event.dataTransfer?.files ?? []);
        if (files.length === 0) return false;
        event.preventDefault();
        const at = view.posAtCoords({
          left: event.clientX,
          top: event.clientY,
        });
        uploadFiles(editor, files, at?.pos ?? editor.state.selection.to);
        return true;
      },
    },
  });
}
