import { DurableStreamTestServer } from "@durable-streams/server";
import {
  startYjsServer,
  stopYjsServer,
} from "../../../apps/api/src/documents/index";

/**
 * Durable Streams (the in-process test server) with `YjsServer` in front of
 * it, on free ports, as the API runs them. Returns what to call afterwards.
 */
export async function startPageStreams() {
  const streams = new DurableStreamTestServer({ port: 0 });
  process.env.DURABLE_STREAMS_URL = await streams.start();
  const yjsUrl = await startYjsServer(0);
  return {
    yjsUrl,
    async stop() {
      await stopYjsServer();
      await streams.stop();
    },
  };
}
