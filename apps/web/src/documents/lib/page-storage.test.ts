import { describe, expect, it } from "vite-plus/test";
import {
  deletePageStorage,
  forgetClientId,
  pageDatabaseName,
  readClientId,
  writeClientId,
} from "./page-storage";

function memoryStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  return {
    items,
    get length() {
      return items.size;
    },
    key: (index: number) => [...items.keys()][index] ?? null,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
}

/** An IndexedDB factory that lists some databases and records which were deleted. */
function fakeFactory(names: string[]) {
  const deleted: string[] = [];
  return {
    deleted,
    databases: async () => names.map((name) => ({ name, version: 1 })),
    deleteDatabase: (name: string) => {
      deleted.push(name);
      const request = {} as IDBOpenDBRequest;
      queueMicrotask(() => request.onsuccess?.({} as Event));
      return request;
    },
  };
}

describe("page database names", () => {
  it("belong to one user, page and generation", () => {
    expect(pageDatabaseName("u1", "d1", 2)).toBe("morrow:u1:doc:d1:g2");
  });
});

describe("client ids kept for a tab", () => {
  it("are read back, per user and page", () => {
    const storage = memoryStorage();
    writeClientId("u1", "d1", 12345, storage);
    expect(readClientId("u1", "d1", storage)).toBe(12345);
    expect(readClientId("u2", "d1", storage)).toBeNull();
    expect(readClientId("u1", "d2", storage)).toBeNull();
  });

  it("can be forgotten", () => {
    const storage = memoryStorage();
    writeClientId("u1", "d1", 12345, storage);
    forgetClientId("u1", "d1", storage);
    expect(readClientId("u1", "d1", storage)).toBeNull();
  });
});

describe("deletePageStorage", () => {
  it("deletes every page database and client id, and nothing else", async () => {
    const factory = fakeFactory([
      pageDatabaseName("u1", "d1", 1),
      pageDatabaseName("u1", "d2", 1),
      "morrow-local-database",
      "other-app",
    ]);
    const storage = memoryStorage({
      "morrow:u1:doc-client:d1": "42",
      "morrow:sidebar-projects-open": "true",
    });

    await deletePageStorage(factory, storage);

    expect(factory.deleted).toEqual([
      "morrow:u1:doc:d1:g1",
      "morrow:u1:doc:d2:g1",
    ]);
    expect([...storage.items.keys()]).toEqual(["morrow:sidebar-projects-open"]);
  });
});
