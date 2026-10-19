import { type ComponentProps, lazy, Suspense } from "react";
import { cn } from "@/design-system/cn";

const loadEditor = () => import("./description-markdown-editor");

const DescriptionMarkdownEditor = lazy(() =>
  loadEditor().then((m) => ({ default: m.DescriptionMarkdownEditor })),
);

type EditorProps = ComponentProps<typeof DescriptionMarkdownEditor>;

/** Starts fetching the editor chunk; calling it again is free. */
export function preloadTaskDescriptionEditor() {
  void loadEditor();
}

/**
 * The markdown description editor, loaded on demand: its code (Tiptap,
 * ProseMirror, syntax highlighting) is large and most page loads never open
 * it. Until it arrives the description reads as plain text.
 */
export function TaskDescriptionEditor(props: EditorProps) {
  return (
    <Suspense
      fallback={
        <PlainDescription
          value={props.value}
          placeholder={props.placeholder}
          className={props.className}
        />
      }
    >
      <DescriptionMarkdownEditor {...props} />
    </Suspense>
  );
}

function PlainDescription({
  value,
  placeholder,
  className,
}: Pick<EditorProps, "value" | "placeholder" | "className">) {
  return (
    <div
      className={cn(
        "min-h-16 whitespace-pre-wrap text-sm",
        !value && "text-muted-foreground",
        className,
      )}
    >
      {value || placeholder}
    </div>
  );
}
