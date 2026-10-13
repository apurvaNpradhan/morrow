import { Readable } from "node:stream";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  type HeadObjectCommandOutput,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createId } from "@paralleldrive/cuid2";
import { config as appConfig } from "#api/platform/config";

const allowedImageMimeTypes = new Set([
  "image/apng",
  "image/avif",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

export function isImageContentType(contentType: string) {
  return allowedImageMimeTypes.has(contentType.toLowerCase());
}

type UploadSurface = "draft";

type StorageConfig = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl?: string;
  keyPrefix: string;
  forcePathStyle: boolean;
  maxImageUploadBytes: number;
  presignTtlSeconds: number;
};

type DraftAssetUploadContext = {
  workspaceId: string;
  userId: string;
  surface: UploadSurface;
  filename: string;
  contentType: string;
};

type DraftAssetUploadUrl = {
  key: string;
  uploadUrl: string;
  headers: Record<string, string>;
};

type AssetObject = {
  body: unknown;
  contentType: string | undefined;
  contentLength: number | undefined;
  etag: string | undefined;
  lastModified: Date | undefined;
};

let clientCache:
  | {
      cacheKey: string;
      client: S3Client;
    }
  | undefined;

/**
 * Resolves static S3 credentials from the access key pair.
 *
 * Returns the explicit credentials only when BOTH the access key id and secret
 * are provided. When neither is set, returns `undefined` so the AWS SDK falls
 * back to its default credential provider chain (EC2 instance profile, ECS task
 * role, EKS IRSA, environment variables, or shared config), enabling
 * IAM-role-based access without static keys.
 *
 * Throws when exactly one of the two is set, since that is almost always a
 * misconfiguration rather than an intentional fallback.
 */
export function resolveS3Credentials(
  accessKeyId: string,
  secretAccessKey: string,
): { accessKeyId: string; secretAccessKey: string } | undefined {
  const hasAccessKeyId = Boolean(accessKeyId);
  const hasSecretAccessKey = Boolean(secretAccessKey);

  if (hasAccessKeyId !== hasSecretAccessKey) {
    throw new Error(
      "Incomplete S3 credentials. Set both S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY, or neither to use the default AWS credential provider chain (IAM role / IRSA / environment).",
    );
  }

  if (hasAccessKeyId && hasSecretAccessKey) {
    return { accessKeyId, secretAccessKey };
  }

  return undefined;
}

function getStorageConfig(): StorageConfig {
  const { endpoint, bucket, accessKeyId, secretAccessKey, ...rest } =
    appConfig.s3;

  if (!endpoint || !bucket) {
    throw new Error(
      "S3 uploads are not configured. Set S3_ENDPOINT and S3_BUCKET (and either both S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY, or neither to use the default AWS credential provider chain / IAM role).",
    );
  }

  // Validate the access key pair early so misconfiguration surfaces here rather
  // than as an opaque signing error later.
  resolveS3Credentials(accessKeyId, secretAccessKey);

  return { endpoint, bucket, accessKeyId, secretAccessKey, ...rest };
}

function getMaxImageUploadBytes() {
  return appConfig.s3.maxImageUploadBytes;
}

function getClient(config: StorageConfig) {
  const cacheKey = JSON.stringify({
    endpoint: config.endpoint,
    region: config.region,
    accessKeyId: config.accessKeyId,
    bucket: config.bucket,
    forcePathStyle: config.forcePathStyle,
  });

  if (clientCache?.cacheKey === cacheKey) {
    return clientCache.client;
  }

  const clientConfig: S3ClientConfig = {
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    // Avoid auto-injecting checksum params for presigned PUT URLs. Some
    // S3-compatible providers (e.g. Garage/R2) reject mismatched hoisted CRCs.
    requestChecksumCalculation: "WHEN_REQUIRED",
  };

  const credentials = resolveS3Credentials(
    config.accessKeyId,
    config.secretAccessKey,
  );

  // Only pin explicit credentials when both keys are provided. Otherwise leave
  // `credentials` unset so the AWS SDK resolves them from its default provider
  // chain (EC2 instance profile, ECS task role, EKS IRSA, env, shared config),
  // which is how IAM-role-based access works.
  if (credentials) {
    clientConfig.credentials = credentials;
  }

  const client = new S3Client(clientConfig);
  clientCache = { cacheKey, client };
  return client;
}

export function sanitizePathSegment(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^-+|-+$/g, "") || "file"
  );
}

export function getFileExtension(filename: string) {
  const normalized = filename.trim();
  const extension = normalized.includes(".")
    ? normalized.split(".").pop() || ""
    : "";

  return sanitizePathSegment(extension).slice(0, 12);
}

export function buildDraftAssetObjectKeyPrefix(
  context: Pick<DraftAssetUploadContext, "workspaceId" | "userId" | "surface">,
) {
  return [
    "workspace",
    sanitizePathSegment(context.workspaceId),
    "user",
    sanitizePathSegment(context.userId),
    context.surface,
  ].join("/");
}

export function buildDraftAssetObjectKey(context: DraftAssetUploadContext) {
  const extension = getFileExtension(context.filename);
  const objectKeyPrefix = buildDraftAssetObjectKeyPrefix(context);
  const timestamp = Date.now();
  const randomId = createId();
  const baseName = sanitizePathSegment(
    context.filename.replace(/\.[^/.]+$/, "") || "image",
  ).slice(0, 64);
  const fileName = extension
    ? `${baseName}-${timestamp}-${randomId}.${extension}`
    : `${baseName}-${timestamp}-${randomId}`;
  return `${objectKeyPrefix}/${fileName}`;
}

export function applyKeyPrefix(prefix: string, key: string) {
  if (!prefix) return key;
  const trimmed = prefix.replace(/\/+$/, "");
  return `${trimmed}/${key}`;
}

export function validateDraftAssetUploadInput(
  contentType: string,
  size: number,
) {
  const maxImageUploadBytes = getMaxImageUploadBytes();
  if (!contentType.trim()) {
    throw new Error("A valid content type is required.");
  }
  if (!isImageContentType(contentType)) {
    throw new Error(
      `Unsupported content type "${contentType}". Upload a supported image.`,
    );
  }
  if (!Number.isSafeInteger(size) || size <= 0) {
    throw new Error("Upload size must be a positive safe integer.");
  }
  if (size > maxImageUploadBytes) {
    throw new Error(
      `Upload exceeds the maximum upload size of ${Math.floor(maxImageUploadBytes / (1024 * 1024))}MB.`,
    );
  }
}

export async function createDraftAssetUploadUrl(
  context: DraftAssetUploadContext & { size: number },
): Promise<DraftAssetUploadUrl> {
  validateDraftAssetUploadInput(context.contentType, context.size);
  const config = getStorageConfig();
  const client = getClient(config);
  const key = applyKeyPrefix(
    config.keyPrefix,
    buildDraftAssetObjectKey(context),
  );
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    ContentType: context.contentType,
    ContentLength: context.size,
  });
  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: config.presignTtlSeconds,
    signableHeaders: new Set(["content-length", "content-type"]),
  });
  return {
    key,
    uploadUrl,
    headers: { "Content-Type": context.contentType },
  };
}

export class InvalidUploadedAssetError extends Error {}

/** Call only after checking the object's workspace and user key prefix. */
export async function verifyDraftAssetUpload(
  key: string,
  expected: { size: number; contentType: string },
) {
  const config = getStorageConfig();
  const client = getClient(config);
  const abortSignal = AbortSignal.timeout(10_000);
  let object: HeadObjectCommandOutput;
  try {
    object = await client.send(
      new HeadObjectCommand({ Bucket: config.bucket, Key: key }),
      { abortSignal },
    );
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "NotFound" ||
        error.name === "NoSuchKey" ||
        ("$metadata" in error &&
          (error.$metadata as { httpStatusCode?: number }).httpStatusCode ===
            404))
    ) {
      throw new InvalidUploadedAssetError("Uploaded object was not found.");
    }
    // Provider errors may include endpoints, signed URLs or other secrets.
    throw new Error("Unable to verify uploaded object.");
  }

  const size = object.ContentLength;
  if (typeof size === "number" && size > config.maxImageUploadBytes) {
    // Also remove oversized objects made with a still-valid older upload URL.
    // Invalid client size claims never cause deletion of an in-limit object.
    try {
      await client.send(
        new DeleteObjectCommand({ Bucket: config.bucket, Key: key }),
        { abortSignal },
      );
    } catch {
      throw new Error("Unable to remove oversized uploaded object.");
    }
    throw new InvalidUploadedAssetError(
      "Uploaded object exceeds the maximum upload size.",
    );
  }
  if (
    !Number.isSafeInteger(size) ||
    !size ||
    size !== expected.size ||
    !object.ContentType ||
    object.ContentType.toLowerCase() !== expected.contentType.toLowerCase()
  ) {
    throw new InvalidUploadedAssetError(
      "Uploaded object does not match the declared size and content type.",
    );
  }
  return { size, contentType: object.ContentType };
}

export function assertStorageConfigured() {
  return getStorageConfig();
}

export function assertDraftAssetKeyMatchesContext(
  key: string,
  context: Pick<DraftAssetUploadContext, "workspaceId" | "userId" | "surface">,
) {
  const config = getStorageConfig();
  const objectPrefix = buildDraftAssetObjectKeyPrefix(context);
  const fullPrefix = `${applyKeyPrefix(config.keyPrefix, objectPrefix)}/`;
  if (!key.startsWith(fullPrefix)) return false;
  const suffix = key.slice(fullPrefix.length);
  return /^[A-Za-z0-9._-]+$/.test(suffix) && !suffix.startsWith(".");
}

export async function getPrivateObject(key: string): Promise<AssetObject> {
  const config = getStorageConfig();
  const client = getClient(config);
  const response = await client.send(
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: key,
    }),
  );

  if (!response.Body) {
    throw new Error("Storage object body is missing.");
  }

  const body =
    "transformToWebStream" in response.Body
      ? response.Body.transformToWebStream()
      : Readable.toWeb(response.Body as Readable);

  return {
    body,
    contentType: response.ContentType,
    contentLength: response.ContentLength,
    etag: response.ETag,
    lastModified: response.LastModified,
  };
}

export async function deleteS3Object(key: string): Promise<void> {
  const config = getStorageConfig();
  const client = getClient(config);
  await client.send(
    new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: key,
    }),
  );
}

/**
 * Stores a publicly served object. Keys carry a fresh id, so an object never
 * changes and can be cached forever.
 */
export async function putPublicObject(
  key: string,
  body: Uint8Array,
  contentType: string,
): Promise<void> {
  const config = getStorageConfig();
  await getClient(config).send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
}

function publicBase(): string {
  const base = getStorageConfig().publicBaseUrl?.replace(/\/+$/, "");
  if (!base) throw new Error("S3_PUBLIC_BASE_URL is not configured.");
  return base;
}

/** The public URL of an object key. */
export function publicUrl(key: string): string {
  return `${publicBase()}/${key}`;
}

/** The object key behind a public URL, or null for a URL that is not ours. */
export function keyFromPublicUrl(url: string): string | null {
  const prefix = `${publicBase()}/`;
  return url.startsWith(prefix) ? url.slice(prefix.length) : null;
}

/** Whether avatars can be stored: endpoint, bucket and public URL are set. */
export function isPublicStorageConfigured(): boolean {
  const { endpoint, bucket, publicBaseUrl } = appConfig.s3;
  return Boolean(endpoint && bucket && publicBaseUrl);
}
