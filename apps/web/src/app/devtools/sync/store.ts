/** A value the panel can subscribe to (`useSyncExternalStore`). */
export function createStore<T>(initial: T) {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next: T) {
      value = next;
      for (const listener of listeners) listener();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

const LOG_LIMIT = 200;

/** An in-memory log of the last 200 entries, newest last. */
export function createLog<T extends { id: number }>() {
  const store = createStore<T[]>([]);
  let nextId = 1;
  return {
    get: store.get,
    subscribe: store.subscribe,
    nextId: () => nextId++,
    push(entry: T) {
      store.set([...store.get(), entry].slice(-LOG_LIMIT));
    },
    update(id: number, patch: Partial<T>) {
      store.set(
        store
          .get()
          .map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
      );
    },
    clear: () => store.set([]),
  };
}
