import { BLOCK_ID_TYPES, documentExtensions } from "@morrow/document-schema";
import { Collaboration, isChangeOrigin } from "@tiptap/extension-collaboration";
import Placeholder from "@tiptap/extension-placeholder";
import { UniqueID } from "@tiptap/extension-unique-id";
import type { Extensions } from "@tiptap/react";
import type * as Y from "yjs";
import {
  documentExtensionsWithViews,
  editingExtensions,
} from "./editing-pieces";

/** The fragment of a page's `Y.Doc` the editor binds to. */
export const DOCUMENT_FRAGMENT = "default";

/**
 * Gives a block an id when this client's own typing creates it. Never on
 * opening a page and never for a remote or reader's transaction: those would
 * each write an update the user did not make. Tiptap's UniqueID would number
 * the whole page on the first sync when it finds no provider, so that is turned off.
 */
const BlockIdMinting = UniqueID.extend({
  onCreate() {
    this.storage.needsInitialIdGeneration = false;
  },
});

/**
 * Every extension of a page's editor: the shared schema with its views, the
 * editing behaviour, and the Collaboration binding to the page's `Y.Doc`.
 * `isEditable` is read at each transaction, so a page archived while open
 * stops minting ids.
 */
export function pageExtensions(
  doc: Y.Doc,
  placeholder: string,
  isEditable: () => boolean,
): Extensions {
  return [
    ...documentExtensionsWithViews(documentExtensions),
    ...editingExtensions({ collaborative: true }),
    Placeholder.configure({ placeholder }),
    Collaboration.configure({ document: doc, field: DOCUMENT_FRAGMENT }),
    BlockIdMinting.configure({
      attributeName: "blockId",
      types: BLOCK_ID_TYPES,
      generateID: () => crypto.randomUUID(),
      filterTransaction: (transaction) =>
        isEditable() && !isChangeOrigin(transaction),
    }),
  ];
}
