import * as decoding from "lib0/decoding";

/**
 * The updates in a request body of the Yjs Durable Streams protocol (section 7
 * of YJS-PROTOCOL.md): each one is a varint length followed by that many bytes,
 * and a client may concatenate several in one POST. Throws on a body that does
 * not end exactly at a frame boundary.
 */
export function decodeFramedUpdates(body: Uint8Array): Uint8Array[] {
  const decoder = decoding.createDecoder(body);
  const updates: Uint8Array[] = [];
  while (decoding.hasContent(decoder)) {
    updates.push(decoding.readVarUint8Array(decoder));
  }
  return updates;
}
