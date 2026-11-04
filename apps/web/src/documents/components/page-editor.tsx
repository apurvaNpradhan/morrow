import { EditorContent, useEditor } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/design-system/ui/skeleton";
import { BubbleLinkEditor, SlashCommands } from "../lib/editing-pieces";
import { DOCUMENT_FRAGMENT, pageExtensions } from "../lib/page-extensions";
import type { OpenPage, OpenPageOptions } from "../lib/open-page";
import { useOpenPage, usePageState } from "../queries/use-open-page";
import { PageEndedNotice } from "./page-ended-notice";

/** Whether the page's Yjs document has any content yet (from the stored copy or the server). */
function useHasContent(session: OpenPage) {
  const [hasContent, setHasContent] = useState(false);
  useEffect(() => {
    const fragment = session.doc.getXmlFragment(DOCUMENT_FRAGMENT);
    const check = () => setHasContent(fragment.length > 0);
    check();
    fragment.observeDeep(check);
    return () => fragment.unobserveDeep(check);
  }, [session]);
  return hasContent;
}

/**
 * The page's text, edited together with everyone else on it. The editor is
 * bound to the session's `Y.Doc`. It stays read-only until the document has
 * content, because the server writes a page's first paragraph and a client
 * typing into the empty view before it arrives would add a second one.
 */
export function PageEditor({
  readOnly,
  ...options
}: OpenPageOptions & {
  /** The page is archived, or the role cannot edit. */
  readOnly: boolean;
}) {
  const session = useOpenPage(options);
  if (!session) return <Skeleton className="h-64 w-full" />;
  return <OpenPageEditor session={session} readOnly={readOnly} />;
}

function OpenPageEditor({
  session,
  readOnly,
}: {
  session: OpenPage;
  readOnly: boolean;
}) {
  const { t } = useTranslation("documents");
  const state = usePageState(session);
  const hasContent = useHasContent(session);
  const editable =
    !readOnly && state.phase === "ready" && state.writable && hasContent;
  const editableRef = useRef(editable);
  editableRef.current = editable;

  const editor = useEditor(
    {
      extensions: [
        ...pageExtensions(
          session.doc,
          t("editor.placeholder"),
          () => editableRef.current,
        ),
        SlashCommands,
      ],
      editable,
      editorProps: {
        attributes: {
          "aria-label": t("editor.label"),
          role: "textbox",
          "aria-multiline": "true",
        },
      },
    },
    [session],
  );

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  return (
    <>
      {state.phase === "ended" ? (
        <PageEndedNotice
          refusal={state.refusal}
          unsentText={editor?.getText() ?? ""}
        />
      ) : null}
      <EditorContent
        editor={editor}
        className="morrow-tiptap-content text-base leading-relaxed [&_.ProseMirror]:min-h-64 [&_.ProseMirror]:outline-none"
      />
      {editor ? <BubbleLinkEditor editor={editor} /> : null}
    </>
  );
}
