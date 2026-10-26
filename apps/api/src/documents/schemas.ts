import {
  DOCUMENT_TITLE_MAX,
  isProjectEmoji,
  PROJECT_ICONS,
} from "@morrow/sync-schemas";
import { z } from "zod";

/** The fields clients send. Every limit lives here, once. */

export const workspaceId = z.string().min(1);
export const documentId = z.string().min(1);

/** A client-chosen id; its format is checked by the operation (INVALID_DOCUMENT_ID). */
export const newDocumentId = z.string().min(1).max(64);

/** A page's Project, or null for the Workspace root. */
export const projectId = z.string().min(1).nullable();
/** A page's parent, or null for the top of its Project (or of the root). */
export const parentId = z.string().min(1).nullable();

export const documentTitle = z.string().trim().max(DOCUMENT_TITLE_MAX);
/** A Lucide icon name from the list, or a single emoji. */
export const documentIcon = z.union([
  z.enum(PROJECT_ICONS),
  z.string().refine(isProjectEmoji),
]);

/** A fractional-index key; its format is checked by the operation. */
export const position = z.string().min(1).max(64);

/** A Yjs client id: an unsigned 32-bit integer. */
export const yjsClientId = z.number().int().min(0).max(4_294_967_295);
