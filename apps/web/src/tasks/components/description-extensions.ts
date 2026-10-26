import { documentExtensions } from "@morrow/document-schema";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { ListKeymap } from "@tiptap/extension-list";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Dropcursor,
  Gapcursor,
  TrailingNode,
  UndoRedo,
} from "@tiptap/extensions";
import type { Extensions } from "@tiptap/react";
import { common, createLowlight } from "lowlight";
import { AttachmentCardWithView } from "../attachments/attachment-card-view";
import { TicketReference } from "./ticket-reference";

const lowlight = createLowlight(common);

/** The nodes of the shared schema that need more than their schema part in the browser. */
const WITH_VIEWS = new Map<string, Extensions[number]>([
  ["codeBlock", CodeBlockLowlight.configure({ lowlight })],
  ["ticketReference", TicketReference],
  ["attachmentCard", AttachmentCardWithView],
]);

/** The shared schema's extensions with their views: same schema, drawn in the browser. */
export const documentExtensionsWithViews = (
  extensions: Extensions = documentExtensions,
) => extensions.map((extension) => WITH_VIEWS.get(extension.name) ?? extension);

/** What a description has no way to write yet: pages' collapsible blocks, mentions and page links. */
const NOT_IN_DESCRIPTIONS = new Set([
  "details",
  "detailsSummary",
  "detailsContent",
  "mention",
  "pageLink",
  "blockIds",
]);

/**
 * The editing behaviour every text editor of the app has: the cursors, list
 * keys, undo and the empty line after a last block. None of it is schema. A
 * collaborative editor leaves out the last two: its undo is Yjs's, which
 * reverts only your own changes, and an empty line added on its own would be
 * written by every client that opens the page.
 */
export const editingExtensions = (
  options: { collaborative?: boolean } = {},
): Extensions => [
  Dropcursor,
  Gapcursor,
  ListKeymap,
  ...(options.collaborative ? [] : [UndoRedo, TrailingNode]),
];

/**
 * The description and comment editor's extensions: the shared schema, minus
 * what only pages use, with views and the editing behaviours. Menus and file
 * handling are added by the editor itself.
 */
export const descriptionExtensions = (placeholder: string): Extensions => [
  ...documentExtensionsWithViews(
    documentExtensions.filter((e) => !NOT_IN_DESCRIPTIONS.has(e.name)),
  ),
  ...editingExtensions(),
  Placeholder.configure({ placeholder }),
];
