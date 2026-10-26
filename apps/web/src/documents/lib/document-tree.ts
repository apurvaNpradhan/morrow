import { comparePosition, type DocumentRow } from "@morrow/sync-schemas";
import { generateKeyBetween } from "fractional-indexing";

/** The part of the page tree a view shows: a Project's pages, or the Workspace root's (`null`). */
export type TreeScope = { projectId: string | null };

/** A row of the tree as drawn: the page and where it sits. */
export type TreeRow = {
  document: DocumentRow;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
};

export type PageIndex = {
  byId: ReadonlyMap<string, DocumentRow>;
  /** Pages hidden from the tree: archived ones and everything under them. */
  hidden: ReadonlySet<string>;
  /** Visible children by parent id (`null` for the top of a scope), in order. */
  childrenOf: (parentId: string | null, scope: TreeScope) => DocumentRow[];
};

/**
 * Indexes a Workspace's pages. A page is hidden when it or any page above it
 * is archived, so archiving a page hides its subtree at once, before the
 * server has stamped the descendants.
 */
export function indexPages(rows: readonly DocumentRow[]): PageIndex {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const hidden = new Set<string>();
  const hides = (row: DocumentRow, seen: Set<string>): boolean => {
    if (hidden.has(row.id)) return true;
    if (row.archivedAt) return true;
    const parent = row.parentId ? byId.get(row.parentId) : undefined;
    if (!parent || seen.has(parent.id)) return false;
    seen.add(row.id);
    return hides(parent, seen);
  };
  for (const row of rows) {
    if (hides(row, new Set())) hidden.add(row.id);
  }

  const children = new Map<string | null, DocumentRow[]>();
  for (const row of rows) {
    if (hidden.has(row.id)) continue;
    const parentId =
      row.parentId && byId.has(row.parentId) ? row.parentId : null;
    children.set(parentId, [...(children.get(parentId) ?? []), row]);
  }
  for (const list of children.values()) list.sort(comparePosition);

  return {
    byId,
    hidden,
    childrenOf(parentId, scope) {
      const list = children.get(parentId) ?? [];
      return parentId === null
        ? list.filter((row) => row.projectId === scope.projectId)
        : list;
    },
  };
}

/** The rows of a scope in tree order, with the children of expanded pages only. */
export function visibleRows(
  index: PageIndex,
  scope: TreeScope,
  expanded: ReadonlySet<string>,
): TreeRow[] {
  const rows: TreeRow[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const document of index.childrenOf(parentId, scope)) {
      const hasChildren = index.childrenOf(document.id, scope).length > 0;
      const isOpen = hasChildren && expanded.has(document.id);
      rows.push({ document, depth, hasChildren, expanded: isOpen });
      if (isOpen) walk(document.id, depth + 1);
    }
  };
  walk(null, 0);
  return rows;
}

/** The pages from the top of the scope down to `documentId`, for opening a tree on a page. */
export function ancestorIds(index: PageIndex, documentId: string): string[] {
  const ids: string[] = [];
  let current = index.byId.get(documentId)?.parentId ?? null;
  while (current !== null && !ids.includes(current)) {
    ids.unshift(current);
    current = index.byId.get(current)?.parentId ?? null;
  }
  return ids;
}

/** Whether `candidateId` is the page or anywhere under it. */
export function isInSubtree(
  index: PageIndex,
  documentId: string,
  candidateId: string,
): boolean {
  let current: string | null = candidateId;
  const seen = new Set<string>();
  while (current !== null && !seen.has(current)) {
    if (current === documentId) return true;
    seen.add(current);
    current = index.byId.get(current)?.parentId ?? null;
  }
  return false;
}

/** Where a dragged page lands relative to the page under the pointer. */
export type DropZone = "before" | "inside" | "after";

export type MoveTarget = {
  parentId: string | null;
  projectId: string | null;
  position: string;
};

/**
 * Where dropping `dragged` on `onto` puts it: before or after it among its
 * siblings, or as the last child inside it. Null when the drop changes
 * nothing or is not allowed (onto itself or its own subtree).
 */
export function moveTarget(
  index: PageIndex,
  dragged: DocumentRow,
  onto: DocumentRow,
  zone: DropZone,
  scope: TreeScope,
): MoveTarget | null {
  if (isInSubtree(index, dragged.id, onto.id)) return null;

  if (zone === "inside") {
    const siblings = index
      .childrenOf(onto.id, scope)
      .filter((row) => row.id !== dragged.id);
    const position = generateKeyBetween(
      siblings.at(-1)?.position ?? null,
      null,
    );
    return { parentId: onto.id, projectId: onto.projectId, position };
  }

  const siblings = index
    .childrenOf(onto.parentId, { projectId: onto.projectId })
    .filter((row) => row.id !== dragged.id);
  const at = siblings.findIndex((row) => row.id === onto.id);
  const before = zone === "before" ? siblings[at - 1] : siblings[at];
  const after = zone === "before" ? siblings[at] : siblings[at + 1];
  const position = generateKeyBetween(
    before?.position ?? null,
    after?.position ?? null,
  );
  if (
    dragged.parentId === onto.parentId &&
    dragged.projectId === onto.projectId &&
    dragged.position === position
  ) {
    return null;
  }
  return { parentId: onto.parentId, projectId: onto.projectId, position };
}

/** The position after a level's last page, for a page added at the end. */
export function positionAtEnd(
  index: PageIndex,
  parentId: string | null,
  scope: TreeScope,
): string {
  return generateKeyBetween(
    index.childrenOf(parentId, scope).at(-1)?.position ?? null,
    null,
  );
}
