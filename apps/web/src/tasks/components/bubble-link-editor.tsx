import type { Editor } from "@tiptap/react";
import { Link2, Pencil, Unlink } from "lucide-react";
import { useEffect, useReducer, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/design-system/ui/button";
import { Input } from "@/design-system/ui/input";
import { normalizeLinkHref } from "./normalize-link-href";
import { selectionStartAnchor } from "./selection-start-anchor";

const TOOLBAR_HEIGHT = 40;
const TOOLBAR_WIDTH = 288;

/**
 * A small toolbar at the start of the selection: a link button that turns
 * into a URL field (Enter applies, Esc cancels), and edit and remove on an
 * existing link. Bare domains get `https://` and email addresses `mailto:`.
 */
export function BubbleLinkEditor({ editor }: { editor: Editor }) {
  const { t } = useTranslation("tasks");
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    editor.on("transaction", refresh);
    editor.on("focus", refresh);
    editor.on("blur", refresh);
    return () => {
      editor.off("transaction", refresh);
      editor.off("focus", refresh);
      editor.off("blur", refresh);
    };
  }, [editor]);

  const onLink = editor.isActive("link");
  const hasSelection = !editor.state.selection.empty;
  const shown =
    editor.isEditable &&
    (editing || ((editor.isFocused || false) && (hasSelection || onLink)));
  if (!shown) return null;
  const anchor = selectionStartAnchor(editor);
  if (!anchor) return null;

  function startEditing() {
    setValue(editor.getAttributes("link").href ?? "");
    setInvalid(false);
    setEditing(true);
  }

  function stopEditing() {
    setEditing(false);
    editor.commands.focus();
  }

  function apply() {
    const href = normalizeLinkHref(value);
    if (!href) {
      setInvalid(true);
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    setEditing(false);
  }

  const left = Math.max(
    8,
    Math.min(anchor.left, window.innerWidth - TOOLBAR_WIDTH - 8),
  );
  const top =
    anchor.top - TOOLBAR_HEIGHT - 6 < 8
      ? anchor.bottom + 6
      : anchor.top - TOOLBAR_HEIGHT - 6;

  return createPortal(
    <div
      role="toolbar"
      aria-label={t("link.toolbar")}
      data-slot="bubble-link-editor"
      tabIndex={-1}
      className="fixed z-[300] flex items-center gap-1 rounded-lg border bg-popover p-1 text-popover-foreground shadow-overlay"
      style={{ left, top }}
      // Keep the editor's selection while a toolbar button is pressed.
      onMouseDown={(event) => {
        if (!(event.target instanceof HTMLInputElement)) event.preventDefault();
      }}
    >
      {editing ? (
        <form
          className="flex flex-col gap-1"
          onSubmit={(event) => {
            event.preventDefault();
            apply();
          }}
        >
          <Input
            autoFocus
            size="sm"
            className="w-72"
            value={value}
            aria-label={t("link.url")}
            aria-invalid={invalid}
            placeholder={t("link.placeholder")}
            onChange={(event) => {
              setValue(event.target.value);
              setInvalid(false);
            }}
            onKeyDown={(event) => {
              if (event.key !== "Escape") return;
              // Only the link edit ends; the sheet and the page stay.
              event.preventDefault();
              event.stopPropagation();
              event.nativeEvent.stopImmediatePropagation();
              stopEditing();
            }}
          />
          {invalid ? (
            <p role="alert" className="px-1 text-destructive text-xs">
              {t("link.invalid")}
            </p>
          ) : null}
        </form>
      ) : onLink ? (
        <>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t("link.edit")}
            onClick={startEditing}
          >
            <Pencil aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t("link.remove")}
            onClick={() =>
              editor.chain().focus().extendMarkRange("link").unsetLink().run()
            }
          >
            <Unlink aria-hidden="true" />
          </Button>
        </>
      ) : (
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={t("link.add")}
          onClick={startEditing}
        >
          <Link2 aria-hidden="true" />
        </Button>
      )}
    </div>,
    document.body,
  );
}
