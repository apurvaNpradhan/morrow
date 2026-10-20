import { describe, expect, it } from "vite-plus/test";
import { sniffImage } from "./sniff-image";

const u16be = (n: number) => [(n >> 8) & 0xff, n & 0xff];
const u32be = (n: number) => [...u16be(n >>> 16), ...u16be(n & 0xffff)];
const u16le = (n: number) => [n & 0xff, (n >> 8) & 0xff];
const u24le = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff];
const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));

const png = (w: number, h: number) =>
  Uint8Array.from([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
    ...u32be(13),
    ...ascii("IHDR"),
    ...u32be(w),
    ...u32be(h),
    8,
    6,
    0,
    0,
    0,
  ]);

const gif = (w: number, h: number) =>
  Uint8Array.from([...ascii("GIF89a"), ...u16le(w), ...u16le(h), 0, 0, 0]);

/** SOI, an APP0 segment to skip, then SOF0 with the size. */
const jpeg = (w: number, h: number) =>
  Uint8Array.from([
    0xff,
    0xd8,
    0xff,
    0xe0,
    0x00,
    0x04,
    0x4a,
    0x46,
    0xff,
    0xc0,
    0x00,
    0x0b,
    8,
    ...u16be(h),
    ...u16be(w),
    1,
    1,
    0x11,
    0,
  ]);

const webpLossy = (w: number, h: number) =>
  Uint8Array.from([
    ...ascii("RIFF"),
    0,
    0,
    0,
    0,
    ...ascii("WEBP"),
    ...ascii("VP8 "),
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0x9d,
    0x01,
    0x2a,
    ...u16le(w),
    ...u16le(h),
  ]);

const webpLossless = (w: number, h: number) => {
  const bits = (w - 1) | ((h - 1) << 14);
  return Uint8Array.from([
    ...ascii("RIFF"),
    0,
    0,
    0,
    0,
    ...ascii("WEBP"),
    ...ascii("VP8L"),
    0,
    0,
    0,
    0,
    0x2f,
    bits & 0xff,
    (bits >> 8) & 0xff,
    (bits >> 16) & 0xff,
    (bits >> 24) & 0xff,
  ]);
};

const webpExtended = (w: number, h: number) =>
  Uint8Array.from([
    ...ascii("RIFF"),
    0,
    0,
    0,
    0,
    ...ascii("WEBP"),
    ...ascii("VP8X"),
    10,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    ...u24le(w - 1),
    ...u24le(h - 1),
  ]);

describe("sniffImage", () => {
  it("reads a PNG", () => {
    expect(sniffImage(png(1200, 800))).toEqual({
      mimeType: "image/png",
      width: 1200,
      height: 800,
    });
  });

  it("reads a GIF", () => {
    expect(sniffImage(gif(64, 32))).toEqual({
      mimeType: "image/gif",
      width: 64,
      height: 32,
    });
  });

  it("reads a JPEG past its leading segments", () => {
    expect(sniffImage(jpeg(4000, 3000))).toEqual({
      mimeType: "image/jpeg",
      width: 4000,
      height: 3000,
    });
  });

  it("reads lossy, lossless and extended WebP", () => {
    for (const [bytes, size] of [
      [webpLossy(300, 200), [300, 200]],
      [webpLossless(640, 480), [640, 480]],
      [webpExtended(1920, 1080), [1920, 1080]],
    ] as const) {
      expect(sniffImage(bytes)).toEqual({
        mimeType: "image/webp",
        width: size[0],
        height: size[1],
      });
    }
  });

  it("recognises the type but leaves the size out when the header is cut short", () => {
    expect(sniffImage(png(1, 1).slice(0, 12))).toEqual({
      mimeType: "image/png",
      width: null,
      height: null,
    });
  });

  it("does not take other bytes for an image", () => {
    expect(
      sniffImage(Uint8Array.from(ascii("%PDF-1.7 not an image"))),
    ).toBeNull();
    expect(sniffImage(Uint8Array.from(ascii("<svg xmlns=...")))).toBeNull();
    expect(sniffImage(new Uint8Array())).toBeNull();
  });
});
