import * as encoding from "lib0/encoding";
import { YJS_SERVICE } from "./yjs-proxy";
import type { YjsTarget } from "./yjs-access";

type PageStream = Omit<YjsTarget, "workspaceId">;

const streamUrl = (yjsUrl: string, { docId, generation }: PageStream) =>
  `${yjsUrl}/v1/yjs/${YJS_SERVICE}/docs/${docId}/g${generation}`;

/**
 * Creates a page's stream on `YjsServer`, holding `update` if one is given.
 * The browser cannot do this (the proxy only asks whether a stream exists), so
 * `documents.create` and the rebuild script do it. Returns false, writing
 * nothing, when the stream already exists.
 */
export async function createPageStream(
  yjsUrl: string,
  target: PageStream,
  update?: Uint8Array,
): Promise<boolean> {
  const url = streamUrl(yjsUrl, target);
  const created = await fetch(url, { method: "PUT" });
  await created.body?.cancel();
  if (created.status === 200) return false;
  if (created.status !== 201) {
    throw new Error(`Creating the page stream failed: ${created.status}`);
  }
  if (update) {
    const framed = encoding.createEncoder();
    encoding.writeVarUint8Array(framed, update);
    const written = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/octet-stream" },
      body: encoding.toUint8Array(framed),
    });
    await written.body?.cancel();
    if (!written.ok) {
      throw new Error(`Writing the page stream failed: ${written.status}`);
    }
  }
  return true;
}
