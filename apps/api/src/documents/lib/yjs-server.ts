import { YjsServer } from "@durable-streams/y-durable-streams/server";
import { config } from "#api/platform/config";

/** `YjsServer` listens here, on the loopback interface only; the page proxy is its one client. */
const YJS_SERVER_PORT = 4438;

let running: YjsServer | undefined;

/**
 * Starts `YjsServer` in front of the Durable Streams server. Safe to call
 * twice. Tests pass 0 for a free port.
 */
export async function startYjsServer(port = YJS_SERVER_PORT) {
  if (running) return running.url;
  // Under `tsx watch` the previous process may still be shutting down and
  // holding the port, so wait for it instead of crashing the restart.
  for (let attempt = 0; ; attempt++) {
    const server = new YjsServer({
      host: "127.0.0.1",
      port,
      dsServerUrl: config.durableStreamsUrl,
    });
    try {
      await server.start();
      running = server;
      return server.url;
    } catch (error) {
      const inUse = (error as NodeJS.ErrnoException).code === "EADDRINUSE";
      if (!inUse || port === 0 || attempt >= 20) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
}

export async function stopYjsServer() {
  const server = running;
  running = undefined;
  await server?.stop();
}

/** Where `YjsServer` listens; throws before `startYjsServer`. */
export function yjsServerUrl() {
  if (!running) throw new Error("YjsServer is not running");
  return running.url;
}
