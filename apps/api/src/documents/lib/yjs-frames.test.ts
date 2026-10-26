import * as encoding from "lib0/encoding";
import { describe, expect, it } from "vite-plus/test";
import { decodeFramedUpdates } from "./yjs-frames";

function frame(...updates: Uint8Array[]) {
  const encoder = encoding.createEncoder();
  for (const update of updates) encoding.writeVarUint8Array(encoder, update);
  return encoding.toUint8Array(encoder);
}

describe("decodeFramedUpdates", () => {
  it("reads one update", () => {
    expect(decodeFramedUpdates(frame(Uint8Array.of(1, 2, 3)))).toEqual([
      Uint8Array.of(1, 2, 3),
    ]);
  });

  it("reads several updates a client batched into one body", () => {
    const long = new Uint8Array(300).fill(7);
    expect(
      decodeFramedUpdates(frame(Uint8Array.of(9), long, Uint8Array.of())),
    ).toEqual([Uint8Array.of(9), long, Uint8Array.of()]);
  });

  it("reads an empty body as no updates", () => {
    expect(decodeFramedUpdates(new Uint8Array())).toEqual([]);
  });

  it("refuses a body that is cut short", () => {
    const whole = frame(Uint8Array.of(1, 2, 3, 4));
    expect(() => decodeFramedUpdates(whole.subarray(0, 3))).toThrow();
  });
});
