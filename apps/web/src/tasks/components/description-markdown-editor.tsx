import { Markdown } from "@tiptap/markdown";
import { type Editor, EditorContent, useEditor } from "@tiptap/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/design-system/cn";
import {
  AttachmentUploads,
  pickFiles,
  setBusyListener,
  setUploadHandlers,
} from "../attachments/attachment-uploads";
import { ImageLightbox } from "../attachments/image-lightbox";
import { useAttachmentUploads } from "../attachments/use-attachment-uploads";
import { looksLikeMarkdown } from "../lib/looks-like-markdown";
import { BubbleLinkEditor } from "./bubble-link-editor";
import { DescriptionCharacterCount } from "./description-character-count";
import { descriptionExtensions } from "./description-extensions";
import { SlashCommands } from "./slash-extension";

/**
 * The markdown description editor: headings, bold, italic, strike, inline
 * code, highlighted code blocks, tables, bullet, numbered and task lists,
 * quotes, links and dividers. Markdown shortcuts format as you type; the
 * value is markdown. A `/` at the start of a word opens a menu of blocks. Given
 * a `workspaceId` it also takes files: paste, drop, `/attach` or the picker put
 * images in the text and other files in as cards (see `attachments/`).
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
  workspaceId,
  onAttachReady,
  onUploadingChange,
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
  /** The Workspace files upload to; without it the editor takes no files. */
  workspaceId?: string;
  /** Hands out a function that opens the file picker, or null while there is none. */
  onAttachReady?: (attach: (() => void) | null) => void;
  /** How many uploads are running. */
  onUploadingChange?: (running: number) => void;
}) {
  // The markdown last put into the editor or sent out of it. A `value` that
  // differs from it is a change from elsewhere; comparing with the editor's own
  // markdown instead would reset text that merely serializes differently.
  const applied = useRef(value);
  const [focused, setFocused] = useState(false);
  const [markdownLength, setMarkdownLength] = useState(value.length);
  const editorRef = useRef<Editor | null>(null);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(
    null,
  );
  const uploads = useAttachmentUploads(workspaceId);
  // Parents pass new functions on every render; the latest one is used, and
  // changing it re-registers nothing.
  const attachReady = useRef(onAttachReady);
  const editor = useEditor({
    extensions: [
      ...descriptionExtensions(placeholder ?? ""),
      SlashCommands,
      AttachmentUploads,
      Markdown,
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
      // An image opens full size.
      handleClickOn: (_view, _pos, node) => {
        if (node.type.name !== "assetImage") return false;
        setLightbox({ src: node.attrs.src, alt: node.attrs.alt });
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

  useEffect(() => {
    if (editor) setUploadHandlers(editor, uploads);
  }, [editor, uploads]);

  useEffect(() => {
    if (editor) setBusyListener(editor, onUploadingChange);
  }, [editor, onUploadingChange]);

  // The function that opens the file picker, stable while it can be used.
  const attach = useMemo(
    () => (editor && uploads && editable ? () => pickFiles(editor) : null),
    [editor, uploads, editable],
  );
  useEffect(() => {
    attachReady.current = onAttachReady;
  });
  useEffect(() => {
    attachReady.current?.(attach);
  }, [attach]);
  useEffect(() => () => attachReady.current?.(null), []);

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
      <ImageLightbox image={lightbox} onClose={() => setLightbox(null)} />
      {limit !== undefined ? (
        <DescriptionCharacterCount count={markdownLength} limit={limit} />
      ) : null}
    </>
  );
}
