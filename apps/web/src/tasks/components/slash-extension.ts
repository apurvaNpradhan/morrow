import type { EditorState } from "@tiptap/pm/state";
import { Extension } from "@tiptap/react";
import Suggestion, { type SuggestionProps } from "@tiptap/suggestion";
import type { CSSProperties } from "react";
import { canUpload } from "../attachments/attachment-uploads";
import { filterSlashCommands, type SlashCommand } from "./slash-commands";
import { mountSlashMenu } from "./slash-menu";

const MENU_WIDTH = 256;
const MENU_HEIGHT = 320;
const GAP = 6;

/** A `/` opens the menu at the start of a line or after whitespace. */
function startsWord(state: EditorState, from: number) {
  const $from = state.doc.resolve(from);
  if ($from.parentOffset === 0) return true;
  return /\s/.test(
    $from.parent.textBetween($from.parentOffset - 1, $from.parentOffset),
  );
}

/** Below the typed `/` when there is room, otherwise above it; kept inside the window. */
function placementFor(rect: DOMRect | null | undefined): CSSProperties {
  if (!rect) return {};
  const left = Math.max(
    GAP,
    Math.min(rect.left, window.innerWidth - MENU_WIDTH - GAP),
  );
  if (window.innerHeight - rect.bottom >= MENU_HEIGHT) {
    return { left, top: rect.bottom + GAP };
  }
  return { left, bottom: window.innerHeight - rect.top + GAP };
}

/**
 * The suggestion renderer: it keeps the selected row, moves it with the arrow
 * keys and picks it with Enter. Escape is passed on; the plugin closes the menu.
 */
function createSlashRenderer() {
  let menu: ReturnType<typeof mountSlashMenu> | null = null;
  let current: SuggestionProps<SlashCommand> | null = null;
  let selected = 0;

  function draw() {
    if (!menu || !current) return;
    menu.render({
      items: current.items,
      selected,
      style: placementFor(current.clientRect?.()),
      onHover: (index) => {
        selected = index;
        draw();
      },
      onSelect: pick,
    });
  }

  function pick(index: number) {
    const item = current?.items[index];
    if (item) current?.command(item);
  }

  return {
    onStart(props: SuggestionProps<SlashCommand>) {
      menu = mountSlashMenu();
      current = props;
      selected = 0;
      draw();
    },
    onUpdate(props: SuggestionProps<SlashCommand>) {
      current = props;
      selected = Math.min(selected, Math.max(props.items.length - 1, 0));
      draw();
    },
    onKeyDown({ event }: { event: KeyboardEvent }) {
      const count = current?.items.length ?? 0;
      if (event.key === "Escape") return true;
      if (count === 0 || event.isComposing) return false;
      if (event.key === "ArrowDown") {
        selected = (selected + 1) % count;
        draw();
        return true;
      }
      if (event.key === "ArrowUp") {
        selected = (selected + count - 1) % count;
        draw();
        return true;
      }
      if (event.key === "Enter") {
        pick(selected);
        return true;
      }
      return false;
    },
    onExit() {
      menu?.unmount();
      menu = null;
      current = null;
    },
  };
}

/**
 * Opens the block menu on a `/` typed at a line start or after whitespace,
 * outside code blocks and only while the editor is editable. It inserts no
 * node: the typed `/query` is removed when a block is chosen.
 */
export const SlashCommands = Extension.create({
  name: "slashCommands",

  addProseMirrorPlugins() {
    return [
      Suggestion<SlashCommand>({
        editor: this.editor,
        char: "/",
        allowedPrefixes: null,
        allow: ({ editor, state, range }) =>
          editor.isEditable &&
          startsWord(state, range.from) &&
          !state.doc.resolve(range.from).parent.type.spec.code,
        items: ({ editor, query }) =>
          filterSlashCommands(query).filter(
            (command) => !command.needsUploads || canUpload(editor),
          ),
        command: ({ editor, range, props }) => props.run(editor, range),
        render: createSlashRenderer,
      }),
    ];
  },
});
