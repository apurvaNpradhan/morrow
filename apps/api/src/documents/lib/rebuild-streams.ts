import { getDocumentSchema } from "@morrow/document-schema";
import { prosemirrorJSONToYDoc } from "@tiptap/y-tiptap";
import { eq } from "drizzle-orm";
import * as Y from "yjs";
import { db } from "#api/platform/database/index";
import {
  documentBodyTable,
  documentClientTable,
  documentTable,
} from "../tables";
import { DOCUMENT_FRAGMENT, emptyDocument } from "./empty-document";
import { createPageStream } from "./yjs-streams";

/**
 * Recreates the current stream of every page from `document_body`, for a
 * Durable Streams volume that was lost. A page that has no body yet starts
 * empty. Streams that already exist are left alone, so it can be run again.
 * Each rebuilt stream is written by one new client id, registered as a system
 * client so its text still has an author.
 */
export async function rebuildDocumentStreams(yjsUrl: string) {
  const pages = await db
    .select({
      id: documentTable.id,
      generation: documentTable.generation,
      createdBy: documentTable.createdBy,
      content: documentBodyTable.content,
    })
    .from(documentTable)
    .leftJoin(
      documentBodyTable,
      eq(documentBodyTable.documentId, documentTable.id),
    );

  let created = 0;
  let skipped = 0;
  for (const page of pages) {
    let update: Uint8Array;
    let clientId: number;
    if (page.content) {
      const doc = prosemirrorJSONToYDoc(
        getDocumentSchema(),
        page.content as object,
        DOCUMENT_FRAGMENT,
      );
      update = Y.encodeStateAsUpdate(doc);
      clientId = doc.clientID;
    } else {
      ({ update, clientId } = emptyDocument());
    }
    const wasCreated = await createPageStream(
      yjsUrl,
      { docId: page.id, generation: page.generation },
      update,
    );
    if (!wasCreated) {
      skipped += 1;
      continue;
    }
    await db
      .insert(documentClientTable)
      .values({
        documentId: page.id,
        yjsClientId: clientId,
        userId: page.createdBy ?? "system",
        via: "system",
      })
      .onConflictDoNothing();
    created += 1;
  }
  return { created, skipped };
}
