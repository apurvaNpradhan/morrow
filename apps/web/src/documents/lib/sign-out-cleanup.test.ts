import { afterEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("@/app/sync/local-database", () => ({
  beginLocalWipe: vi.fn(),
  finishLocalWipe: vi.fn(async () => undefined),
  restoresFromLocal: false,
}));

import { cleanupSyncedCollections } from "@/app/sync/synced-collections";
import { pageDatabaseName } from "./page-storage";

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe("signing out", () => {
  it("deletes the IndexedDB copies of pages and the client ids kept for them", async () => {
    const deleted: string[] = [];
    vi.stubGlobal("indexedDB", {
      databases: async () => [
        { name: pageDatabaseName("u1", "d1", 1) },
        { name: "morrow-sync.sqlite" },
      ],
      deleteDatabase: (name: string) => {
        deleted.push(name);
        const request = {} as IDBOpenDBRequest;
        queueMicrotask(() => request.onsuccess?.({} as Event));
        return request;
      },
    });
    sessionStorage.setItem("morrow:u1:doc-client:d1", "4242");

    await cleanupSyncedCollections();

    expect(deleted).toEqual(["morrow:u1:doc:d1:g1"]);
    expect(sessionStorage.getItem("morrow:u1:doc-client:d1")).toBeNull();
  });
});
