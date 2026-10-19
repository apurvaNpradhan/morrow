import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Table,
  TableCell,
  TableHeader,
  TableRow,
} from "@tiptap/extension-table";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Markdown } from "@tiptap/markdown";
import { type Editor, EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { common, createLowlight } from "lowlight";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/design-system/cn";
import { looksLikeMarkdown } from "../lib/looks-like-markdown";
import { BubbleLinkEditor } from "./bubble-link-editor";
import { DescriptionCharacterCount } from "./description-character-count";
import { SlashCommands } from "./slash-extension";
import { TicketReference } from "./ticket-reference";

const lowlight = createLowlight(common);

/**
 * The markdown description editor: headings, bold, italic, strike, inline
 * code, highlighted code blocks, tables, bullet, numbered and task lists,
 * quotes, links and dividers. Markdown shortcuts format as you type; the
 * value is markdown. A `/` at the start of a word opens a menu of blocks.
 */
export function DescriptionMarkdownEditor({
  value,
  onChange,
  editable = true,
  placeholder,
  autoFocus = false,
  label,
  className,
  onSubmit,
  limit,
}: {
  value: string;
  onChange: (markdown: string) => void;
  editable?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  label: string;
  className?: string;
  /** Mod+Enter, for the create dialog. */
  onSubmit?: () => void;
  /** Longest markdown the API accepts; the count shows near it. */
  limit?: number;
}) {
  // The markdown last put into the editor or sent out of it. A `value` that
  // differs from it is a change from elsewhere; comparing with the editor's own
  // markdown instead would reset text that merely serializes differently.
  const applied = useRef(value);
  const [focused, setFocused] = useState(false);
  const [markdownLength, setMarkdownLength] = useState(value.length);
  const editorRef = useRef<Editor | null>(null);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        underline: false,
        codeBlock: false,
        link: {
          openOnClick: "whenNotEditable",
          autolink: true,
          // Only what the link field itself accepts; no `javascript:` from a paste.
          isAllowedUri: (url) => /^(https?:\/\/|mailto:)/i.test(url),
          HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
        },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      CodeBlockLowlight.configure({ lowlight }),
      Table,
      TableRow,
      TableHeader,
      TableCell,
      SlashCommands,
      TicketReference,
      Markdown,
      Placeholder.configure({ placeholder: placeholder ?? "" }),
    ],
    content: value,
    contentType: "markdown",
    editable,
    autofocus: autoFocus ? "end" : false,
    editorProps: {
      attributes: {
        "aria-label": label,
        role: "textbox",
        "aria-multiline": "true",
      },
      // Pasted markdown becomes formatting, not literal characters. Inside a
      // code block it stays text, and rich content from a web page keeps its
      // own HTML when the text is not markdown.
      handlePaste: (_view, event) => {
        const text = event.clipboardData?.getData("text/plain") ?? "";
        const current = editorRef.current;
        if (
          !current ||
          !looksLikeMarkdown(text) ||
          current.isActive("codeBlock")
        ) {
          return false;
        }
        event.preventDefault();
        current.commands.insertContent(text, { contentType: "markdown" });
        return true;
      },
      handleKeyDown: (_view, event) => {
        if (
          onSubmit &&
          event.key === "Enter" &&
          (event.metaKey || event.ctrlKey)
        ) {
          event.preventDefault();
          onSubmit();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: updated }) => {
      const markdown = updated.getMarkdown();
      applied.current = markdown;
      setMarkdownLength(markdown.length);
      onChange(markdown);
    },
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
  });

  useEffect(() => {
    editorRef.current = editor;
    if (editor) setMarkdownLength(editor.getMarkdown().length);
  }, [editor]);

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  // A change that arrives from elsewhere replaces what is shown, unless the
  // user is typing here; it is applied once they leave the editor.
  useEffect(() => {
    if (!editor || focused || value === applied.current) return;
    applied.current = value;
    editor.commands.setContent(value, {
      contentType: "markdown",
      emitUpdate: false,
    });
    setMarkdownLength(editor.getMarkdown().length);
  }, [editor, focused, value]);

  return (
    <>
      <EditorContent
        editor={editor}
        className={cn(
          "morrow-tiptap-content text-sm [&_.ProseMirror]:min-h-16 [&_.ProseMirror]:outline-none",
          className,
        )}
      />
      {editor ? <BubbleLinkEditor editor={editor} /> : null}
      {limit !== undefined ? (
        <DescriptionCharacterCount count={markdownLength} limit={limit} />
      ) : null}
    </>
  );
}
