/** Polls until `check` returns a value, or fails after `timeoutMs` (jobs run asynchronously). */
export async function waitFor<T>(
  check: () => T | undefined | null | Promise<T | undefined | null>,
  timeoutMs = 10_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (true) {
    const value = await check();
    if (value !== undefined && value !== null) return value;
    if (Date.now() > deadline) {
      throw new Error(`Condition not met within ${timeoutMs}ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
