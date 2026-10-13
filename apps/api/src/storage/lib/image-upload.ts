import { ORPCError } from "@orpc/server";

export const MAX_IMAGE_BYTES = 512 * 1024;
/** The image plus the multipart envelope around it. */
export const MAX_IMAGE_REQUEST_BYTES = MAX_IMAGE_BYTES + 16 * 1024;

type ImageKind = { contentType: string; extension: string };

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((byte, index) => bytes[offset + index] === byte);

/** The image type named by the file's leading bytes; the declared type is never trusted. */
export function detectImageKind(bytes: Uint8Array): ImageKind | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { contentType: "image/png", extension: "png" };
  }
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }
  // RIFF....WEBP
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return { contentType: "image/webp", extension: "webp" };
  }
  return null;
}

/** A coded BAD_REQUEST the clients map to a translated message. */
function imageError(code: string) {
  return new ORPCError("BAD_REQUEST", { data: { code } });
}

/** Checks a submitted file and returns its bytes and type. */
export async function readImageFile(file: Blob) {
  if (file.size === 0) throw imageError("IMAGE_INVALID");
  if (file.size > MAX_IMAGE_BYTES) throw imageError("IMAGE_TOO_LARGE");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = detectImageKind(bytes);
  if (!kind) throw imageError("IMAGE_UNSUPPORTED_TYPE");
  return { bytes, ...kind };
}
