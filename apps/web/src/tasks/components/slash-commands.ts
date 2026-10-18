import type { Editor, Range } from "@tiptap/react";

export type SlashGroup = "text" | "lists" | "insert";

export type SlashCommand = {
  id: string;
  label: string;
  group: SlashGroup;
  /** Other words the query matches, such as "h1" or "todo". */
  search: string;
  /** Replaces the typed `/query` at `range` with the block. */
  run: (editor: Editor, range: Range) => void;
};

export const slashCommands: SlashCommand[] = [
  {
    id: "text",
    label: "Text",
    group: "text",
    search: "paragraph normal plain",
    run: (editor, range) => {
      editor.chain().focus().deleteRange(range).setParagraph().run();
    },
  },
  {
    id: "heading-1",
    label: "Heading 1",
    group: "text",
    search: "heading title h1",
    run: (editor, range) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run();
    },
  },
  {
    id: "heading-2",
    label: "Heading 2",
    group: "text",
    search: "heading subtitle h2",
    run: (editor, range) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run();
    },
  },
  {
    id: "heading-3",
    label: "Heading 3",
    group: "text",
    search: "heading h3",
    run: (editor, range) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run();
    },
  },
  {
    id: "bullet-list",
    label: "Bulleted list",
    group: "lists",
    search: "list bullet unordered ul",
    run: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    id: "ordered-list",
    label: "Numbered list",
    group: "lists",
    search: "list ordered numbered ol",
    run: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    id: "task-list",
    label: "Task list",
    group: "lists",
    search: "todo to-do checklist checkbox task",
    run: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },
  {
    id: "blockquote",
    label: "Quote",
    group: "insert",
    search: "quote blockquote",
    run: (editor, range) => {
      editor.chain().focus().deleteRange(range).setBlockquote().run();
    },
  },
  {
    id: "code-block",
    label: "Code block",
    group: "insert",
    search: "code snippet pre",
    run: (editor, range) => {
      editor.chain().focus().deleteRange(range).setCodeBlock().run();
    },
  },
  {
    id: "divider",
    label: "Divider",
    group: "insert",
    search: "divider rule hr line separator",
    run: (editor, range) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
  {
    id: "table",
    label: "Table",
    group: "insert",
    search: "table grid",
    run: (editor, range) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run();
    },
  },
];

/** The commands whose label or search words contain the query, ignoring case. */
export function filterSlashCommands(query: string): SlashCommand[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") return slashCommands;
  return slashCommands.filter(({ label, search }) =>
    [label, search].some((text) => text.toLowerCase().includes(needle)),
  );
}
