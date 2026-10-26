import { onSyncedCollectionsCleared } from "@/app/sync/synced-collections";

/*
 * What the browser keeps of a page between visits: its Yjs document in
 * IndexedDB (so unsent edits survive a reload) and, for the length of a tab,
 * the Yjs client id the page was last edited with.
 */

/** The IndexedDB database of one user's copy of one page's generation. */
export function pageDatabaseName(
  userId: string,
  documentId: string,
  generation: number,
) {
  return `morrow:${userId}:doc:${documentId}:g${generation}`;
}

const PAGE_DATABASE = /^morrow:[^:]+:doc:/;
const CLIENT_ID_KEY = (userId: string, documentId: string) =>
  `morrow:${userId}:doc-client:${documentId}`;
const CLIENT_ID_PREFIX = "morrow:";

/**
 * The client id this tab last edited the page with. It lives in session
 * storage, which a reload keeps and another tab does not share: two tabs
 * writing with one client id would corrupt the page.
 */
export function readClientId(
  userId: string,
  documentId: string,
  storage: Pick<Storage, "getItem"> = sessionStorage,
): number | null {
  try {
    const value = Number(storage.getItem(CLIENT_ID_KEY(userId, documentId)));
    return Number.isInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

export function writeClientId(
  userId: string,
  documentId: string,
  clientId: number,
  storage: Pick<Storage, "setItem"> = sessionStorage,
) {
  try {
    storage.setItem(CLIENT_ID_KEY(userId, documentId), String(clientId));
  } catch {
    // Without it a reload registers a new id, which only costs a request.
  }
}

export function forgetClientId(
  userId: string,
  documentId: string,
  storage: Pick<Storage, "removeItem"> = sessionStorage,
) {
  try {
    storage.removeItem(CLIENT_ID_KEY(userId, documentId));
  } catch {
    // Nothing was stored.
  }
}

type DatabaseFactory = Pick<IDBFactory, "databases" | "deleteDatabase">;

function deleteDatabase(factory: DatabaseFactory, name: string) {
  return new Promise<void>((resolve) => {
    const request = factory.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    // An open editor holds the database; it is deleted when the page reloads.
    request.onblocked = () => resolve();
  });
}

/**
 * Deletes every page copy on this device, and the client ids kept for them.
 * Signing out runs it, so the next person to use the browser finds none of
 * the previous user's text.
 */
export async function deletePageStorage(
  factory: DatabaseFactory | undefined = globalThis.indexedDB,
  storage: Pick<Storage, "length" | "key" | "removeItem"> = sessionStorage,
) {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key?.startsWith(CLIENT_ID_PREFIX) && key.includes(":doc-client:")) {
      keys.push(key);
    }
  }
  keys.forEach((key) => storage.removeItem(key));

  if (!factory) return;
  const databases = await factory.databases().catch(() => []);
  await Promise.all(
    databases
      .map((database) => database.name)
      .filter((name): name is string => !!name && PAGE_DATABASE.test(name))
      .map((name) => deleteDatabase(factory, name)),
  );
}

onSyncedCollectionsCleared(() => deletePageStorage());
