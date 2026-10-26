import { YjsProvider } from "@durable-streams/y-durable-streams";
import { ORPCError } from "@orpc/client";
import * as random from "lib0/random";
import { IndexeddbPersistence } from "y-indexeddb";
import * as Y from "yjs";
import { env } from "@/app/lib/env";
import { rpc } from "@/app/lib/orpc";
import { detailCode } from "@/app/lib/orpc-error";
import { isRetryable, refusalOf, type PageRefusal } from "./page-refusal";
import {
  forgetClientId,
  pageDatabaseName,
  readClientId,
  writeClientId,
} from "./page-storage";
import { bridgeToServer } from "./server-bridge";

/** The API's codes for a fault on its side, which a later request may not meet. */
const SERVER_FAULTS = new Set([
  "INTERNAL_SERVER_ERROR",
  "BAD_GATEWAY",
  "SERVICE_UNAVAILABLE",
  "GATEWAY_TIMEOUT",
]);

/** How long to wait before asking again after a registration failed without an answer. */
const REGISTER_RETRY_MS = 3000;

export type PageState =
  /** The stored copy is loading, or this tab's Yjs client id is being registered. */
  | { phase: "loading" }
  /** The page is open; `writable` is false for a reader or a page whose id was refused. */
  | { phase: "ready"; writable: boolean }
  /** The session ended: the server refused something it will keep refusing. */
  | { phase: "ended"; refusal: PageRefusal };

export type OpenPageOptions = {
  workspaceId: string;
  userId: string;
  documentId: string;
  generation: number;
  /** Whether the user's role may write pages; readers never register a client id. */
  canEdit: boolean;
};

/**
 * One tab's session on one page: the page's `Y.Doc` (kept in IndexedDB), the
 * provider that follows the page's stream through the proxy, and the Yjs
 * client id registered for this user. The editor binds to `doc`.
 */
export function openPage(options: OpenPageOptions) {
  const { workspaceId, userId, documentId, generation, canEdit } = options;
  const doc = new Y.Doc();
  const server = new Y.Doc();
  const listeners = new Set<(state: PageState) => void>();
  let state: PageState = { phase: "loading" };
  let destroyed = false;
  let provider: YjsProvider | null = null;
  let bridge: ReturnType<typeof bridgeToServer> | null = null;
  // The client id the server knows for this tab; Yjs may swap the doc's own.
  let registeredId: number | null = null;
  let registering = false;

  const persistence = new IndexeddbPersistence(
    pageDatabaseName(userId, documentId, generation),
    doc,
  );

  const setState = (next: PageState) => {
    state = next;
    listeners.forEach((listener) => listener(next));
  };

  /** Makes the Yjs client id this tab writes with known to the server, choosing another if it is taken. */
  async function registerClientId(): Promise<boolean> {
    for (;;) {
      if (destroyed) return false;
      try {
        await rpc.documents.registerClient({
          workspaceId,
          documentId,
          clientId: doc.clientID,
        });
        registeredId = doc.clientID;
        writeClientId(userId, documentId, doc.clientID);
        return true;
      } catch (error) {
        if (detailCode(error) === "CLIENT_ID_TAKEN") {
          doc.clientID = random.uint32();
          continue;
        }
        // An answer below 500 (not found, forbidden, archived) will not change.
        if (error instanceof ORPCError && !SERVER_FAULTS.has(error.code)) {
          return false;
        }
        // No answer, or a server error: keep the edits and ask again.
        if (isRetryable(refusalOf(error))) {
          await new Promise((resolve) =>
            setTimeout(resolve, REGISTER_RETRY_MS),
          );
          continue;
        }
        return false;
      }
    }
  }

  function end(refusal: PageRefusal) {
    if (destroyed || state.phase === "ended") return;
    bridge?.stop();
    bridge = null;
    provider?.destroy();
    provider = null;
    forgetClientId(userId, documentId);
    // The copy in IndexedDB is dropped so a reload starts from the server's page.
    void persistence.clearData();
    setState({ phase: "ended", refusal });
  }

  async function start() {
    await persistence.whenSynced;
    if (destroyed) return;

    let writable = false;
    if (canEdit) {
      const kept = readClientId(userId, documentId);
      if (kept !== null) {
        // Edits typed offline were written with this id, which is already
        // registered; confirm it in the background and write at once.
        doc.clientID = kept;
        registeredId = kept;
        writable = true;
        void registerClientId().then((registered) => {
          if (!registered && state.phase === "ready") {
            setState({ phase: "ready", writable: false });
          }
        });
      } else {
        writable = await registerClientId();
      }
    }
    if (destroyed) return;

    // The provider names its producer after the document's client id.
    server.clientID = doc.clientID;
    provider = new YjsProvider({
      doc: server,
      baseUrl: `${new URL(env.apiOrigin).origin}/api/documents/yjs/${workspaceId}`,
      docId: `${documentId}/g${generation}`,
      liveMode: "long-poll",
    });
    bridge = bridgeToServer(
      doc,
      server,
      provider,
      () => !canEdit || doc.clientID === registeredId,
    );
    // Yjs gives the doc a new client id when it receives structs that carry
    // its own, which a kept id can meet if the stored copy was dropped. Edits
    // written under the new id are held until the server knows it.
    doc.on("afterTransaction", () => {
      if (!canEdit || registering || doc.clientID === registeredId) return;
      registering = true;
      void registerClientId().then((registered) => {
        registering = false;
        if (registered) bridge?.flush();
      });
    });
    provider.on("error", (error) => {
      const refusal = refusalOf(error);
      if (!isRetryable(refusal)) end(refusal);
    });
    if (state.phase === "loading") setState({ phase: "ready", writable });
  }

  void start();

  return {
    doc,
    getState: () => state,
    subscribe(listener: (state: PageState) => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    destroy() {
      destroyed = true;
      listeners.clear();
      bridge?.stop();
      provider?.destroy();
      void persistence.destroy();
      server.destroy();
      doc.destroy();
    },
  };
}

export type OpenPage = ReturnType<typeof openPage>;
