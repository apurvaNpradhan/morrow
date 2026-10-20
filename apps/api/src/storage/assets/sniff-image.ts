export type SniffedImage = {
  mimeType: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
  width: number | null;
  height: number | null;
};

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((byte, index) => bytes[offset + index] === byte);
const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));

const u16be = (b: Uint8Array, at: number) => (b[at]! << 8) | b[at + 1]!;
const u32be = (b: Uint8Array, at: number) =>
  ((b[at]! << 24) | (b[at + 1]! << 16) | (b[at + 2]! << 8) | b[at + 3]!) >>> 0;
const u16le = (b: Uint8Array, at: number) => b[at]! | (b[at + 1]! << 8);
const u32le = (b: Uint8Array, at: number) =>
  (b[at]! | (b[at + 1]! << 8) | (b[at + 2]! << 16) | (b[at + 3]! << 24)) >>> 0;
const u24le = (b: Uint8Array, at: number) =>
  b[at]! | (b[at + 1]! << 8) | (b[at + 2]! << 16);

type Size = { width: number; height: number } | null;

function pngSize(bytes: Uint8Array): Size {
  if (bytes.length < 24) return null;
  return { width: u32be(bytes, 16), height: u32be(bytes, 20) };
}

function gifSize(bytes: Uint8Array): Size {
  if (bytes.length < 10) return null;
  return { width: u16le(bytes, 6), height: u16le(bytes, 8) };
}

/** Walks the marker segments to the first start-of-frame, which holds the size. */
function jpegSize(bytes: Uint8Array): Size {
  let at = 2;
  while (at + 9 < bytes.length) {
    if (bytes[at] !== 0xff) return null;
    const marker = bytes[at + 1]!;
    if (marker === 0xff) {
      at += 1;
      continue;
    }
    // Frame headers: C0–CF except DHT (C4), JPG (C8) and DAC (CC).
    if (
      marker >= 0xc0 &&
      marker <= 0xcf &&
      ![0xc4, 0xc8, 0xcc].includes(marker)
    ) {
      return { width: u16be(bytes, at + 7), height: u16be(bytes, at + 5) };
    }
    at += 2 + u16be(bytes, at + 2);
  }
  return null;
}

function webpSize(bytes: Uint8Array): Size {
  if (bytes.length < 25) return null;
  const chunk = String.fromCharCode(...bytes.subarray(12, 16));
  if (chunk === "VP8 " && bytes.length >= 30) {
    return {
      width: u16le(bytes, 26) & 0x3fff,
      height: u16le(bytes, 28) & 0x3fff,
    };
  }
  if (chunk === "VP8L") {
    const bits = u32le(bytes, 21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === "VP8X" && bytes.length >= 30) {
    return { width: u24le(bytes, 24) + 1, height: u24le(bytes, 27) + 1 };
  }
  return null;
}

/**
 * The image type named by a file's leading bytes, with its pixel size when the
 * bytes reach that far. The declared type and the file name are never trusted.
 */
export function sniffImage(bytes: Uint8Array): SniffedImage | null {
  let mimeType: SniffedImage["mimeType"];
  let size: Size;
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    mimeType = "image/png";
    size = pngSize(bytes);
  } else if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    mimeType = "image/jpeg";
    size = jpegSize(bytes);
  } else if (
    startsWith(bytes, ascii("GIF87a")) ||
    startsWith(bytes, ascii("GIF89a"))
  ) {
    mimeType = "image/gif";
    size = gifSize(bytes);
  } else if (
    startsWith(bytes, ascii("RIFF")) &&
    startsWith(bytes, ascii("WEBP"), 8)
  ) {
    mimeType = "image/webp";
    size = webpSize(bytes);
  } else {
    return null;
  }
  return {
    mimeType,
    width: size && size.width > 0 ? size.width : null,
    height: size && size.height > 0 ? size.height : null,
  };
}
