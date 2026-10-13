export const AVATAR_OUTPUT_SIZE = 256;
export const MAX_AVATAR_SOURCE_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_AVATAR_TYPES = "image/*";

const SUPPORTED_OUTPUT_TYPES = ["image/webp", "image/png"] as const;

/** Why a picked picture can't become an avatar; each maps to a translated message. */
export class AvatarImageError extends Error {
  constructor(
    readonly reason: "not-image" | "source-too-large" | "unreadable",
  ) {
    super(`Avatar image: ${reason}`);
    this.name = "AvatarImageError";
  }
}

function isSupportedOutputType(type: string) {
  return (SUPPORTED_OUTPUT_TYPES as readonly string[]).includes(type);
}

export function getCoverCropRect(width: number, height: number) {
  const side = Math.min(width, height);

  return {
    sourceX: Math.round((width - side) / 2),
    sourceY: Math.round((height - side) / 2),
    side,
  };
}

async function decodeImage(file: File) {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file, { imageOrientation: "from-image" });
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new AvatarImageError("unreadable"));
      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, type, 0.9);
  });
}

/** Crops the picked picture to a square, shrinks it and returns the file to upload. */
export async function prepareAvatarImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) throw new AvatarImageError("not-image");
  if (file.size > MAX_AVATAR_SOURCE_BYTES) {
    throw new AvatarImageError("source-too-large");
  }

  const source = await decodeImage(file);
  const width = "width" in source ? source.width : 0;
  const height = "height" in source ? source.height : 0;

  if (!width || !height) throw new AvatarImageError("unreadable");

  const { sourceX, sourceY, side } = getCoverCropRect(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_OUTPUT_SIZE;
  canvas.height = AVATAR_OUTPUT_SIZE;

  const context = canvas.getContext("2d");
  if (!context) throw new AvatarImageError("unreadable");

  context.imageSmoothingQuality = "high";
  context.drawImage(
    source as CanvasImageSource,
    sourceX,
    sourceY,
    side,
    side,
    0,
    0,
    AVATAR_OUTPUT_SIZE,
    AVATAR_OUTPUT_SIZE,
  );

  if ("close" in source) {
    source.close();
  }

  const blob =
    (await toBlob(canvas, "image/webp")) ?? (await toBlob(canvas, "image/png"));

  if (!blob || !isSupportedOutputType(blob.type)) {
    throw new AvatarImageError("unreadable");
  }

  return new File(
    [blob],
    `avatar.${blob.type === "image/png" ? "png" : "webp"}`,
    {
      type: blob.type,
    },
  );
}
