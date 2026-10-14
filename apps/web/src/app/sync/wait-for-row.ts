type Collection<Row> = {
  get: (key: string) => Row | undefined;
  subscribeChanges: (callback: () => void) => { unsubscribe: () => void };
};

/**
 * Resolves with a synced row as soon as it is in its collection, or rejects
 * after `timeoutMs`. For a row another change is about to deliver, where
 * `awaitMatch` could match an earlier, since-removed copy.
 */
export function waitForRow<Row>(
  collection: Collection<Row>,
  key: string,
  timeoutMs = 5_000,
): Promise<Row> {
  const existing = collection.get(key);
  if (existing) return Promise.resolve(existing);
  return new Promise<Row>((resolve, reject) => {
    const subscription = collection.subscribeChanges(() => {
      const row = collection.get(key);
      if (!row) return;
      clearTimeout(timer);
      subscription.unsubscribe();
      resolve(row);
    });
    const timer = setTimeout(() => {
      subscription.unsubscribe();
      reject(new Error(`Row ${key} did not arrive through sync`));
    }, timeoutMs);
  });
}
