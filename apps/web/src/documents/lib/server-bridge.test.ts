import { ObservableV2 } from "lib0/observable";
import * as Y from "yjs";
import { describe, expect, it } from "vite-plus/test";
import { bridgeToServer } from "./server-bridge";

/** A provider's connection, and the updates it would append to the stream. */
class FakeLink extends ObservableV2<{ status: (status: string) => void }> {
  connected = false;
  sent: Uint8Array[] = [];

  constructor(readonly server: Y.Doc) {
    super();
    // The provider sends every update not tagged "server" while connected.
    server.on("update", (update: Uint8Array, origin: unknown) => {
      if (origin !== "server" && this.connected) this.sent.push(update);
    });
  }

  connect() {
    this.connected = true;
    this.emit("status", ["connected"]);
  }
}

function open(canSend?: () => boolean) {
  const page = new Y.Doc();
  const server = new Y.Doc();
  const link = new FakeLink(server);
  const bridge = bridgeToServer(page, server, link, canSend);
  return { page, server, link, bridge };
}

/** The server's stream as another browser reads it. */
function replayed(link: FakeLink) {
  const other = new Y.Doc();
  link.sent.forEach((update) => Y.applyUpdate(other, update));
  return other;
}

describe("bridgeToServer", () => {
  it("shows the page what the server sends", () => {
    const { page, server, link } = open();
    link.connect();
    const remote = new Y.Doc();
    remote.getText("t").insert(0, "from someone");
    Y.applyUpdate(server, Y.encodeStateAsUpdate(remote), "server");
    expect(page.getText("t").toString()).toBe("from someone");
  });

  it("sends an edit made while connected, and only that", () => {
    const { page, link } = open();
    link.connect();
    page.getText("t").insert(0, "typed");
    expect(link.sent).toHaveLength(1);
    expect(replayed(link).getText("t").toString()).toBe("typed");
  });

  it("sends text typed offline when the connection comes back", () => {
    const { page, link } = open();
    page.getText("t").insert(0, "typed offline");
    expect(link.sent).toHaveLength(0);
    link.connect();
    expect(replayed(link).getText("t").toString()).toBe("typed offline");
  });

  it("sends only this user's own edits, never what the server already held", () => {
    const { page, server, link } = open();
    // IndexedDB kept the page the server holds, plus an unsent word.
    const remote = new Y.Doc();
    remote.getText("t").insert(0, "hello");
    Y.applyUpdate(page, Y.encodeStateAsUpdate(remote), "indexeddb");
    page.getText("t").insert(5, " world");
    Y.applyUpdate(server, Y.encodeStateAsUpdate(remote), "server");

    link.connect();

    const clients = new Set(
      link.sent.flatMap((update) =>
        Y.decodeUpdate(update).structs.map((struct) => struct.id.client),
      ),
    );
    expect([...clients]).toEqual([page.clientID]);
    expect(server.getText("t").toString()).toBe("hello world");
  });

  it("sends nothing on connect when the server has everything", () => {
    const { server, link } = open();
    const remote = new Y.Doc();
    remote.getText("t").insert(0, "hello");
    Y.applyUpdate(server, Y.encodeStateAsUpdate(remote), "server");
    link.connect();
    expect(link.sent).toHaveLength(0);
  });

  it("holds edits while the client id is unregistered and sends them on flush", () => {
    let registered = false;
    const { page, link, bridge } = open(() => registered);
    link.connect();
    page.getText("t").insert(0, "typed with a new id");
    expect(link.sent).toHaveLength(0);

    registered = true;
    bridge.flush();
    expect(replayed(link).getText("t").toString()).toBe("typed with a new id");
  });
});
