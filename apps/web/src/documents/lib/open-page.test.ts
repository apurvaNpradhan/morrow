import { ORPCError } from "@orpc/client";
import { ObservableV2 } from "lib0/observable";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  registerClient: vi.fn(),
  clearData: vi.fn(),
  providers: [] as Array<{
    emit: (event: string, args: unknown[]) => void;
    destroyed: boolean;
  }>,
}));

vi.mock("@/app/lib/orpc", () => ({
  rpc: { documents: { registerClient: mocks.registerClient } },
}));
vi.mock("@/app/lib/env", () => ({
  env: { apiOrigin: "http://localhost:1337" },
}));
vi.mock("y-indexeddb", () => ({
  IndexeddbPersistence: class {
    whenSynced = Promise.resolve(this);
    clearData = mocks.clearData;
    destroy = vi.fn();
  },
}));
vi.mock("@durable-streams/y-durable-streams", () => ({
  YjsProvider: class extends ObservableV2<{
    error: (error: Error) => void;
  }> {
    connected = false;
    destroyed = false;
    constructor() {
      super();
      mocks.providers.push(this as unknown as (typeof mocks.providers)[number]);
    }
    destroy() {
      this.destroyed = true;
    }
  },
}));

import { openPage, type PageState } from "./open-page";
import { readClientId } from "./page-storage";

const options = {
  workspaceId: "w1",
  userId: "u1",
  documentId: "d1",
  generation: 1,
  canEdit: true,
};

/** Waits until the session leaves `loading`. */
function settled(session: ReturnType<typeof openPage>) {
  return new Promise<PageState>((resolve) => {
    const done = (state: PageState) => {
      if (state.phase === "loading") return;
      unsubscribe();
      resolve(state);
    };
    const unsubscribe = session.subscribe(done);
    done(session.getState());
  });
}

beforeEach(() => {
  mocks.registerClient.mockReset().mockResolvedValue({});
  mocks.clearData.mockReset().mockResolvedValue(undefined);
  mocks.providers.length = 0;
  sessionStorage.clear();
});
afterEach(() => vi.useRealTimers());

describe("openPage", () => {
  it("registers the Yjs client id before the page is writable", async () => {
    const session = openPage(options);
    const state = await settled(session);
    expect(state).toEqual({ phase: "ready", writable: true });
    expect(mocks.registerClient).toHaveBeenCalledWith({
      workspaceId: "w1",
      documentId: "d1",
      clientId: session.doc.clientID,
    });
    expect(readClientId("u1", "d1")).toBe(session.doc.clientID);
    session.destroy();
  });

  it("does not register for a reader", async () => {
    const session = openPage({ ...options, canEdit: false });
    expect(await settled(session)).toEqual({ phase: "ready", writable: false });
    expect(mocks.registerClient).not.toHaveBeenCalled();
    session.destroy();
  });

  it("picks a new client id when the server says it is taken", async () => {
    mocks.registerClient.mockRejectedValueOnce(
      new ORPCError("CONFLICT", { data: { code: "CLIENT_ID_TAKEN" } }),
    );
    const session = openPage(options);
    await settled(session);
    const [first, second] = mocks.registerClient.mock.calls.map(
      ([call]) => call.clientId as number,
    );
    expect(second).not.toBe(first);
    expect(second).toBe(session.doc.clientID);
    session.destroy();
  });

  it("writes at once with the id this tab used before, and confirms it in the background", async () => {
    sessionStorage.setItem("morrow:u1:doc-client:d1", "4242");
    const session = openPage(options);
    expect(await settled(session)).toEqual({ phase: "ready", writable: true });
    expect(session.doc.clientID).toBe(4242);
    session.destroy();
  });
});

describe("a client id Yjs replaces", () => {
  it("is registered before the page writes with it", async () => {
    const session = openPage(options);
    await settled(session);
    mocks.registerClient.mockClear();

    // Yjs does this when it receives structs that carry the doc's own id.
    session.doc.clientID = 777;
    session.doc.getText("t").insert(0, "x");

    await vi.waitFor(() =>
      expect(mocks.registerClient).toHaveBeenCalledWith({
        workspaceId: "w1",
        documentId: "d1",
        clientId: 777,
      }),
    );
    session.destroy();
  });
});

describe("the terminal reset", () => {
  it("ends the session, drops the stored copy and forgets the client id on a refusal that will repeat", async () => {
    const session = openPage(options);
    await settled(session);
    const provider = mocks.providers[0]!;

    provider.emit("error", [
      Object.assign(new Error("Bad Request"), {
        status: 400,
        json: { code: "INVALID_UPDATE" },
      }),
    ]);

    expect(session.getState()).toEqual({
      phase: "ended",
      refusal: { code: "INVALID_UPDATE", status: 400 },
    });
    expect(mocks.clearData).toHaveBeenCalledTimes(1);
    expect(provider.destroyed).toBe(true);
    expect(readClientId("u1", "d1")).toBeNull();
    session.destroy();
  });

  it("keeps the edits on a dropped connection, a server error and the rate limit", async () => {
    const session = openPage(options);
    await settled(session);
    const provider = mocks.providers[0]!;

    provider.emit("error", [new TypeError("Failed to fetch")]);
    provider.emit("error", [Object.assign(new Error("down"), { status: 503 })]);
    provider.emit("error", [
      Object.assign(new Error("slow down"), {
        status: 429,
        json: { code: "RATE_LIMITED" },
      }),
    ]);

    expect(session.getState().phase).toBe("ready");
    expect(mocks.clearData).not.toHaveBeenCalled();
    session.destroy();
  });

  it("tells the editor to stop on a schema mismatch", async () => {
    const session = openPage(options);
    await settled(session);
    mocks.providers[0]!.emit("error", [
      Object.assign(new Error("newer"), {
        status: 409,
        json: { code: "SCHEMA_MISMATCH" },
      }),
    ]);
    expect(session.getState()).toMatchObject({
      phase: "ended",
      refusal: { code: "SCHEMA_MISMATCH" },
    });
    session.destroy();
  });
});
