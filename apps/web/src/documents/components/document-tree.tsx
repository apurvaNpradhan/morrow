import { DragDropProvider, type DragMoveEvent } from "@dnd-kit/react";
import { useNavigate } from "@tanstack/react-router";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { errorMessage } from "@/app/lib/error-message";
import { cn } from "@/design-system/cn";
import { toast } from "@/design-system/toast";
import { useWorkspacePermission } from "@/workspace";
import {
  createDocument,
  moveDocument,
  updateDocument,
} from "../actions/document-actions";
import { dropZoneAt } from "../lib/drop-zone";
import {
  ancestorIds,
  type DropZone,
  moveTarget,
  type TreeScope,
  visibleRows,
} from "../lib/document-tree";
import { useDocuments } from "../queries/use-documents";
import { DocumentTreeRow, ROW_HEIGHT } from "./document-tree-row";

type DocumentTreeProps = {
  workspace: { id: string; slug: string };
  /** Whose pages: a Project's, or the Workspace root's. */
  scope: TreeScope;
  /** The page open now, which the tree opens its branch for. */
  activeId: string | null;
  className?: string;
};

type Drop = { id: string; zone: DropZone };

/**
 * The page tree of one scope: virtualized rows, ARIA tree keyboard keys
 * (arrows, Home, End, Enter, F2), inline rename, and drag and drop to
 * reorder or nest. Each drop writes only the moved page; its subtree follows.
 */
export function DocumentTree({
  workspace,
  scope,
  activeId,
  className,
}: DocumentTreeProps) {
  const { t } = useTranslation("documents");
  const navigate = useNavigate();
  const { canEditDocuments } = useWorkspacePermission();
  const index = useDocuments(workspace.id);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [drop, setDrop] = useState<Drop | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const rows = useMemo(
    () => visibleRows(index, scope, expanded),
    [index, scope, expanded],
  );
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
    getItemKey: (i) => rows[i]?.document.id ?? i,
  });

  // Opening a page opens the pages above it.
  useEffect(() => {
    if (!activeId) return;
    const above = ancestorIds(index, activeId);
    setExpanded((current) =>
      above.every((id) => current.has(id))
        ? current
        : new Set([...current, ...above]),
    );
  }, [activeId, index]);

  const toggle = useCallback((id: string, open?: boolean) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (open ?? !next.has(id)) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  function focusRow(position: number) {
    const row = rows[position];
    if (!row) return;
    setFocusedId(row.document.id);
    virtualizer.scrollToIndex(position);
    // The row may not be rendered yet; focus it once it is.
    requestAnimationFrame(() =>
      scroller.current
        ?.querySelector<HTMLElement>(`[data-document-id="${row.document.id}"]`)
        ?.focus(),
    );
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>, position: number) {
    const row = rows[position];
    if (!row || renamingId) return;
    const { document, hasChildren, expanded: open } = row;
    switch (event.key) {
      case "ArrowDown":
        focusRow(Math.min(position + 1, rows.length - 1));
        break;
      case "ArrowUp":
        focusRow(Math.max(position - 1, 0));
        break;
      case "Home":
        focusRow(0);
        break;
      case "End":
        focusRow(rows.length - 1);
        break;
      case "ArrowRight":
        if (hasChildren && !open) toggle(document.id, true);
        else if (open) focusRow(position + 1);
        break;
      case "ArrowLeft":
        if (open) toggle(document.id, false);
        else {
          const parent = rows.findIndex(
            (candidate) => candidate.document.id === document.parentId,
          );
          if (parent >= 0) focusRow(parent);
        }
        break;
      case "Enter":
        void navigate({
          to: "/$slug/pages/$documentId",
          params: { slug: workspace.slug, documentId: document.id },
        });
        break;
      case "F2":
        if (canEditDocuments()) setRenamingId(document.id);
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  async function addSubpage(parentId: string) {
    try {
      const page = await createDocument({
        workspaceId: workspace.id,
        projectId: scope.projectId,
        parentId,
      });
      toggle(parentId, true);
      void navigate({
        to: "/$slug/pages/$documentId",
        params: { slug: workspace.slug, documentId: page.id },
      });
    } catch (error) {
      toast.error(errorMessage(t, error, t("tree.createError")));
    }
  }

  async function rename(id: string, title: string | null) {
    setRenamingId(null);
    const current = index.byId.get(id);
    const trimmed = title?.trim();
    if (trimmed === undefined || !current || trimmed === current.title) return;
    try {
      await updateDocument(id, { title: trimmed });
    } catch (error) {
      toast.error(errorMessage(t, error, t("tree.renameError")));
    }
  }

  /** The row under the pointer and the part of it, while a page is dragged. */
  function track(event: DragMoveEvent) {
    const target = event.operation.target;
    const pointer = event.operation.position.current;
    const element = target?.element;
    if (!target || !element || target.id === event.operation.source?.id) {
      return setDrop(null);
    }
    const rect = element.getBoundingClientRect();
    const next = { id: String(target.id), zone: dropZoneAt(pointer.y, rect) };
    setDrop((current) =>
      current?.id === next.id && current.zone === next.zone ? current : next,
    );
  }

  async function finishDrag(canceled: boolean, draggedId: unknown) {
    const landing = drop;
    setDrop(null);
    if (canceled || !landing || typeof draggedId !== "string") return;
    const dragged = index.byId.get(draggedId);
    const onto = index.byId.get(landing.id);
    if (!dragged || !onto) return;
    const target = moveTarget(index, dragged, onto, landing.zone, scope);
    if (!target) return;
    if (landing.zone === "inside") toggle(onto.id, true);
    try {
      await moveDocument(dragged.id, target);
    } catch (error) {
      toast.error(errorMessage(t, error, t("tree.moveError")));
    }
  }

  return (
    <DragDropProvider
      onDragMove={track}
      onDragEnd={(event) =>
        void finishDrag(event.canceled, event.operation.source?.id)
      }
    >
      <div
        ref={scroller}
        role="tree"
        aria-label={t("tree.label")}
        className={cn("overflow-y-auto", className)}
      >
        <div
          className="relative w-full"
          style={{ height: virtualizer.getTotalSize() }}
        >
          {virtualizer.getVirtualItems().map((item) => {
            const row = rows[item.index];
            if (!row) return null;
            return (
              <div
                key={item.key}
                className="absolute inset-x-0 top-0"
                style={{ transform: `translateY(${item.start}px)` }}
              >
                <DocumentTreeRow
                  row={row}
                  workspaceSlug={workspace.slug}
                  activeId={activeId}
                  focusable={
                    (focusedId ?? rows[0]?.document.id) === row.document.id
                  }
                  dropZone={drop?.id === row.document.id ? drop.zone : null}
                  canMove={canEditDocuments()}
                  renaming={renamingId === row.document.id}
                  onToggle={() => toggle(row.document.id)}
                  onFocusRow={() => setFocusedId(row.document.id)}
                  onKeyDown={(event) => onKeyDown(event, item.index)}
                  onAddSubpage={() => void addSubpage(row.document.id)}
                  onStartRename={() => setRenamingId(row.document.id)}
                  onRename={(title) => void rename(row.document.id, title)}
                />
              </div>
            );
          })}
        </div>
      </div>
    </DragDropProvider>
  );
}
