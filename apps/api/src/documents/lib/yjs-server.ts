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
  const server = new YjsServer({
    host: "127.0.0.1",
    port,
    dsServerUrl: config.durableStreamsUrl,
  });
  await server.start();
  running = server;
  return server.url;
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
