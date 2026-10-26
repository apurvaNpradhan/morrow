import { assignBlockIds, getDocumentSchema } from "@morrow/document-schema";
import { prosemirrorJSONToYDoc } from "@tiptap/y-tiptap";
import * as Y from "yjs";

/** The fragment of a page's `Y.Doc` that the editor binds to. */
export const DOCUMENT_FRAGMENT = "default";

/**
 * A page's first content: one empty paragraph with a block id, as a Yjs
 * update, written by the server so that no client ever seeds a page (two
 * clients seeding at once would each add a paragraph). Returns the update and
 * the Yjs client id that wrote it, which the caller registers.
 */
export function emptyDocument() {
  const doc = prosemirrorJSONToYDoc(
    getDocumentSchema(),
    assignBlockIds({ type: "doc", content: [{ type: "paragraph" }] }),
    DOCUMENT_FRAGMENT,
  );
  return { update: Y.encodeStateAsUpdate(doc), clientId: doc.clientID };
}
