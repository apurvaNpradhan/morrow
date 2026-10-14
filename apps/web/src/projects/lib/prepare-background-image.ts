/** The widest a stored background needs to be; wider pictures are scaled down. */
export const BACKGROUND_MAX_WIDTH = 1600;
/** The API accepts up to 512 KB; stay under it with room for the request envelope. */
const TARGET_BYTES = 480 * 1024;
const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const QUALITIES = [0.85, 0.7, 0.55, 0.4] as const;

/** Why a picked picture can't become a background. */
export class BackgroundImageError extends Error {
  constructor(
    readonly reason: "not-image" | "source-too-large" | "unreadable",
  ) {
    super(`Background image: ${reason}`);
    this.name = "BackgroundImageError";
  }
}

/** The size to draw a picture at: its own, unless it is wider than the limit. */
export function fitWidth(width: number, height: number, maxWidth: number) {
  if (width <= maxWidth) return { width, height };
  return {
    width: maxWidth,
    height: Math.max(1, Math.round((height * maxWidth) / width)),
  };
}

function toBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", quality),
  );
}

/**
 * Scales the picked picture down (keeping its shape) and re-encodes it as WebP
 * until it fits the upload limit.
 */
export async function prepareBackgroundImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/"))
    throw new BackgroundImageError("not-image");
  if (file.size > MAX_SOURCE_BYTES) {
    throw new BackgroundImageError("source-too-large");
  }

  let source: ImageBitmap;
  try {
    source = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new BackgroundImageError("unreadable");
  }
  const { width, height } = fitWidth(
    source.width,
    source.height,
    BACKGROUND_MAX_WIDTH,
  );
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new BackgroundImageError("unreadable");
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, width, height);
  source.close();

  for (const quality of QUALITIES) {
    const blob = await toBlob(canvas, quality);
    if (!blob) throw new BackgroundImageError("unreadable");
    if (blob.size <= TARGET_BYTES) {
      return new File([blob], "background.webp", { type: "image/webp" });
    }
  }
  throw new BackgroundImageError("source-too-large");
}
