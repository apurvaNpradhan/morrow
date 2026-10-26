import { useDraggable, useDroppable } from "@dnd-kit/react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, FileText } from "lucide-react";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/design-system/cn";
import { ProjectIcon } from "@/projects";
import type { DropZone, TreeRow } from "../lib/document-tree";
import { DocumentRowMenu } from "./document-row-menu";

export const ROW_HEIGHT = 28;
const INDENT = 14;

type DocumentTreeRowProps = {
  row: TreeRow;
  workspaceSlug: string;
  /** The page open now. */
  activeId: string | null;
  /** Whether this row is the one the arrow keys act on. */
  focusable: boolean;
  /** Where a dragged page would land if dropped on this row, while one is over it. */
  dropZone: DropZone | null;
  canMove: boolean;
  renaming: boolean;
  onToggle: () => void;
  onFocusRow: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  onAddSubpage: () => void;
  onStartRename: () => void;
  onRename: (title: string | null) => void;
};

/** One row of the page tree: a link to the page, its chevron, its menu, and the drag and drop around it. */
export function DocumentTreeRow({
  row,
  workspaceSlug,
  activeId,
  focusable,
  dropZone,
  canMove,
  renaming,
  onToggle,
  onFocusRow,
  onKeyDown,
  onAddSubpage,
  onStartRename,
  onRename,
}: DocumentTreeRowProps) {
  const { t } = useTranslation("documents");
  const { document, depth, hasChildren, expanded } = row;
  const draggable = useDraggable({ id: document.id, disabled: !canMove });
  const droppable = useDroppable({ id: document.id });
  const title = document.title || t("untitled");

  return (
    <div
      ref={(element) => {
        draggable.ref(element);
        droppable.ref(element);
      }}
      role="treeitem"
      aria-level={depth + 1}
      aria-expanded={hasChildren ? expanded : undefined}
      aria-selected={activeId === document.id}
      data-document-id={document.id}
      tabIndex={focusable ? 0 : -1}
      onFocus={onFocusRow}
      onKeyDown={onKeyDown}
      style={{ height: ROW_HEIGHT, paddingLeft: depth * INDENT + 4 }}
      className={cn(
        "group/row relative flex items-center gap-1 rounded-md pr-1 text-sm outline-none",
        "hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring",
        activeId === document.id &&
          "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
        draggable.isDragging && "opacity-40",
        dropZone === "inside" && "bg-primary/10 ring-1 ring-primary",
      )}
    >
      {dropZone === "before" || dropZone === "after" ? (
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-x-1 h-0.5 rounded-full bg-primary",
            dropZone === "before" ? "-top-px" : "-bottom-px",
          )}
        />
      ) : null}
      <button
        type="button"
        tabIndex={-1}
        aria-label={t(expanded ? "tree.collapse" : "tree.expand", {
          name: title,
        })}
        onClick={onToggle}
        className={cn(
          "grid size-5 shrink-0 place-items-center rounded-sm hover:bg-sidebar-accent",
          !hasChildren && "invisible",
        )}
      >
        <ChevronRight
          aria-hidden="true"
          className={cn(
            "size-3.5 transition-transform duration-150 motion-reduce:transition-none",
            expanded && "rotate-90",
          )}
        />
      </button>
      {renaming ? (
        <RenameInput
          initial={document.title}
          label={t("tree.renameLabel")}
          onDone={onRename}
        />
      ) : (
        <Link
          to="/$slug/pages/$documentId"
          params={{ slug: workspaceSlug, documentId: document.id }}
          tabIndex={-1}
          className="flex min-w-0 flex-1 items-center gap-1.5 self-stretch"
          onDoubleClick={(event) => {
            event.preventDefault();
            onStartRename();
          }}
        >
          {document.icon ? (
            <ProjectIcon project={{ icon: document.icon, key: "" }} />
          ) : (
            <FileText
              aria-hidden="true"
              className="size-4 shrink-0 text-muted-foreground"
            />
          )}
          <span
            className={cn(
              "truncate",
              !document.title && "text-muted-foreground",
            )}
          >
            {title}
          </span>
        </Link>
      )}
      <DocumentRowMenu
        workspaceSlug={workspaceSlug}
        document={document}
        onAddSubpage={onAddSubpage}
        onRename={onStartRename}
      />
    </div>
  );
}

/** The title as text to edit: Enter keeps it, Escape leaves the old one. */
function RenameInput({
  initial,
  label,
  onDone,
}: {
  initial: string;
  label: string;
  onDone: (title: string | null) => void;
}) {
  const [value, setValue] = useState(initial);
  const input = useRef<HTMLInputElement>(null);
  const finished = useRef(false);
  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);

  function finish(title: string | null) {
    if (finished.current) return;
    finished.current = true;
    onDone(title);
  }

  return (
    <input
      ref={input}
      aria-label={label}
      value={value}
      maxLength={200}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => finish(value)}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter") finish(value);
        if (event.key === "Escape") finish(null);
      }}
      className="min-w-0 flex-1 rounded-sm bg-background px-1 outline-none ring-1 ring-ring"
    />
  );
}
