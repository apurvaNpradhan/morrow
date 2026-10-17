import type { Editor } from "@tiptap/react";

/** Viewport coordinates of the start of the editor's selection, or null when it cannot be measured. */
export function selectionStartAnchor(editor: Editor) {
  try {
    const { top, bottom, left } = editor.view.coordsAtPos(
      editor.state.selection.from,
    );
    return { top, bottom, left };
  } catch {
    return null;
  }
}
