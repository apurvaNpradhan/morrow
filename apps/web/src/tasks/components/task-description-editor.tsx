import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Markdown } from "@tiptap/markdown";
import Placeholder from "@tiptap/extension-placeholder";
import { type Editor, EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/design-system/cn";
import { looksLikeMarkdown } from "../lib/looks-like-markdown";
import { BubbleLinkEditor } from "./bubble-link-editor";

/**
 * The markdown description editor: headings, bold, italic, strike, inline
 * code, code blocks, bullet, numbered and task lists, quotes, links and
 * dividers. Markdown shortcuts format as you type; the value is markdown.
 */
export function TaskDescriptionEditor({
  value,
  onChange,
  editable = true,
  placeholder,
  autoFocus = false,
  label,
  className,
  onSubmit,
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
}) {
  // The markdown last put into the editor or sent out of it. A `value` that
  // differs from it is a change from elsewhere; comparing with the editor's own
  // markdown instead would reset text that merely serializes differently.
  const applied = useRef(value);
  const [focused, setFocused] = useState(false);
  const editorRef = useRef<Editor | null>(null);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        underline: false,
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
      onChange(markdown);
    },
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
  });

  useEffect(() => {
    editorRef.current = editor;
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
    </>
  );
}
