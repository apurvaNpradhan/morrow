import * as Y from "yjs";

/** Tags the bridge puts on what it moves, so neither side echoes it back. */
const FROM_SERVER = "bridge:from-server";
const FROM_PAGE = "bridge:from-page";

/** The part of the Yjs provider the bridge uses. */
type Link = {
  connected: boolean;
  on(event: "status", listener: (status: string) => void): void;
  off(event: "status", listener: (status: string) => void): void;
};

/**
 * Joins the page the user edits to the document the provider keeps equal to
 * the server's. The provider sends only the edits made while it is connected,
 * so text typed offline, or kept in IndexedDB from an earlier visit, would
 * never leave the browser. Here the provider drives `server`, which is always
 * exactly what the server holds, and the bridge:
 *
 * - applies every change of `server` to `page`;
 * - sends every change of `page` through `server` while the link is connected;
 * - on each (re)connect, sends what `page` has and `server` lacks.
 *
 * What is sent is therefore only this user's own edits: the server already
 * holds everyone else's.
 */
export function bridgeToServer(page: Y.Doc, server: Y.Doc, link: Link) {
  const toPage = (update: Uint8Array, origin: unknown) => {
    if (origin === FROM_PAGE) return;
    Y.applyUpdate(page, update, FROM_SERVER);
  };
  const toServer = (update: Uint8Array, origin: unknown) => {
    if (origin === FROM_SERVER || !link.connected) return;
    Y.applyUpdate(server, update, FROM_PAGE);
  };
  const sendUnsent = (status: string) => {
    if (status !== "connected") return;
    const update = Y.encodeStateAsUpdate(page, Y.encodeStateVector(server));
    // An update with no structs and no deletions is two zero bytes.
    if (update.length > 2) Y.applyUpdate(server, update, FROM_PAGE);
  };
  server.on("update", toPage);
  page.on("update", toServer);
  link.on("status", sendUnsent);
  return () => {
    server.off("update", toPage);
    page.off("update", toServer);
    link.off("status", sendUnsent);
  };
}
