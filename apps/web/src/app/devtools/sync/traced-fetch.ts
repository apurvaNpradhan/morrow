import { faults } from "./faults";
import { requestLog } from "./request-log";

/**
 * The `fetchClient` of a shape in development: logs every request with the
 * Electric and proxy headers, and applies the faults armed in the panel.
 */
export function tracedFetch(shape: string, base?: typeof fetch): typeof fetch {
  return async (input, init) => {
    const request = base ?? fetch;
    const startedAt = Date.now();
    const url = new URL(
      input instanceof Request ? input.url : String(input),
      location.href,
    );
    const entry = {
      id: requestLog.nextId(),
      shape,
      startedAt,
      offset: url.searchParams.get("offset"),
      handle: url.searchParams.get("handle"),
      live: url.searchParams.get("live") === "true",
    };
    const record = (
      response: Response | undefined,
      rest: { messages?: number; fault?: string; error?: string },
    ) =>
      requestLog.push({
        ...entry,
        durationMs: Date.now() - startedAt,
        status: response?.status ?? 0,
        handle: response?.headers.get("electric-handle") ?? entry.handle,
        upToDate: response?.headers.has("electric-up-to-date") ?? false,
        messages: rest.messages,
        where: response?.headers.get("x-morrow-shape-where") ?? null,
        params: response?.headers.get("x-morrow-shape-params") ?? null,
        fault: rest.fault,
        error: rest.error,
      });

    const { offline, latencyMs } = faults.get();
    if (offline) {
      record(undefined, { fault: "offline" });
      throw new TypeError("Failed to fetch (devtools: offline)");
    }
    const fault = faults.take(shape);
    if (fault) {
      const response = new Response(`Devtools injected ${fault.status}`, {
        status: fault.status,
      });
      record(response, { fault: String(fault.status) });
      return response;
    }
    if (latencyMs > 0)
      await new Promise((resolve) => setTimeout(resolve, latencyMs));

    let response: Response;
    try {
      response = await request(input, init);
    } catch (error) {
      // An abort is Electric stopping a stream, not a failure worth showing.
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        record(undefined, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
      throw error;
    }
    if (entry.live) {
      record(response, {});
    } else {
      // Counted on a clone, after the response is handed back, so the
      // Electric client never waits for it.
      void response
        .clone()
        .json()
        .then((body) => (Array.isArray(body) ? body.length : undefined))
        .catch(() => undefined)
        .then((messages) => record(response, { messages }));
    }
    return response;
  };
}
