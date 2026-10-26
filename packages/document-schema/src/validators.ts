import { parseTicketId } from "@morrow/sync-schemas";

/** What the Workspace a page belongs to contains, for the links that point into it. */
export type WorkspaceRefs = {
  memberIds: ReadonlySet<string>;
  documentIds: ReadonlySet<string>;
};

const ASSET_SOURCE = /^\/api\/asset\/[a-z0-9]+(?:\?w=\d+&h=\d+)?$/;
const ASSET_ID = /^[a-z0-9]+$/;
const HREF = /^(https?:\/\/|mailto:)/i;
const BLOCK_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const hasControlCharacter = (text: string) =>
  [...text].some((c) => c.charCodeAt(0) < 0x20 || c.charCodeAt(0) === 0x7f);

/** An image source must be one of our own assets, never another server. */
export const isAssetSource = (src: unknown): src is string =>
  typeof src === "string" && ASSET_SOURCE.test(src);

/** The only links a page may hold: http(s) or mailto. */
export const isAllowedHref = (href: unknown): href is string =>
  typeof href === "string" &&
  HREF.test(href) &&
  !hasControlCharacter(href) &&
  URL.canParse(href);

/** A block id is a UUID. */
export const isBlockId = (id: unknown): id is string =>
  typeof id === "string" && BLOCK_ID.test(id);

/** A mention names a member of the page's Workspace. */
export const isWorkspaceMention = (id: unknown, refs: WorkspaceRefs) =>
  typeof id === "string" && refs.memberIds.has(id);

/** A page link names a page of the page's Workspace. */
export const isWorkspacePageLink = (docId: unknown, refs: WorkspaceRefs) =>
  typeof docId === "string" && refs.documentIds.has(docId);

/**
 * Why a node's or mark's attributes are refused, or null when they pass. The
 * write check runs it over every inserted element; the names are the schema's.
 */
export function attributeProblem(
  name: string,
  attrs: Readonly<Record<string, unknown>>,
  refs: WorkspaceRefs,
): string | null {
  const blockId = attrs.blockId;
  if (blockId !== undefined && blockId !== null && !isBlockId(blockId)) {
    return "blockId is not a UUID";
  }
  switch (name) {
    case "assetImage":
      return isAssetSource(attrs.src) ? null : "image source is not an asset";
    case "attachmentCard":
      return typeof attrs.id === "string" && ASSET_ID.test(attrs.id)
        ? null
        : "file card id is not an asset id";
    case "link":
      return isAllowedHref(attrs.href) ? null : "link is not http(s) or mailto";
    case "mention":
      return isWorkspaceMention(attrs.id, refs)
        ? null
        : "mention is not a member of the Workspace";
    case "pageLink":
      return isWorkspacePageLink(attrs.docId, refs)
        ? null
        : "page link is not a page of the Workspace";
    case "ticketReference":
      return typeof attrs.ticketId === "string" && parseTicketId(attrs.ticketId)
        ? null
        : "ticket reference is not a ticket id";
    default:
      return null;
  }
}
