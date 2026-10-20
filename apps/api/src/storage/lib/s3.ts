import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config as appConfig } from "#api/platform/config";
import {
  headUploadedObject,
  isMissingObjectError,
} from "./head-uploaded-object";

/** How long a presigned download link works; the browser follows it at once. */
const DOWNLOAD_URL_TTL_SECONDS = 60;

type StorageConfig = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl?: string;
  keyPrefix: string;
  forcePathStyle: boolean;
  presignTtlSeconds: number;
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

/** Whether private assets can be stored: endpoint and bucket are set. */
export function isStorageConfigured(): boolean {
  return Boolean(appConfig.s3.endpoint && appConfig.s3.bucket);
}

export function applyKeyPrefix(prefix: string, key: string) {
  if (!prefix) return key;
  const trimmed = prefix.replace(/\/+$/, "");
  return `${trimmed}/${key}`;
}

/** Every private asset lives under this prefix; the sweep lists it. */
export function assetKeyPrefix() {
  return applyKeyPrefix(appConfig.s3.keyPrefix, "assets/");
}

/** The object key of an asset. It never reaches the client. */
export function assetObjectKey(workspaceId: string, assetId: string) {
  return `${assetKeyPrefix()}${workspaceId}/${assetId}`;
}

/** A presigned PUT the browser uploads the file to; size and type are signed. */
export async function createAssetUploadUrl(options: {
  key: string;
  size: number;
  contentType: string;
}) {
  const config = getStorageConfig();
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: options.key,
    ContentType: options.contentType,
    ContentLength: options.size,
  });
  const uploadUrl = await getSignedUrl(getClient(config), command, {
    expiresIn: config.presignTtlSeconds,
    signableHeaders: new Set(["content-length", "content-type"]),
  });
  return { uploadUrl, headers: { "Content-Type": options.contentType } };
}

/** The stored size of an object, or null when it is not there. */
export async function headAssetObject(key: string) {
  const config = getStorageConfig();
  try {
    const head = await headUploadedObject(
      getClient(config),
      config.bucket,
      key,
      AbortSignal.timeout(10_000),
    );
    return { size: head.ContentLength ?? 0 };
  } catch (error) {
    if (isMissingObjectError(error)) return null;
    throw error;
  }
}

/** The first `length` bytes of an object. */
export async function readAssetHead(key: string, length: number) {
  const config = getStorageConfig();
  const response = await getClient(config).send(
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Range: `bytes=0-${length - 1}`,
    }),
  );
  return response.Body?.transformToByteArray() ?? new Uint8Array();
}

/** Copies an object inside the bucket; the bytes never leave the storage service. */
export async function copyAssetObject(sourceKey: string, targetKey: string) {
  const config = getStorageConfig();
  const source = sourceKey.split("/").map(encodeURIComponent).join("/");
  await getClient(config).send(
    new CopyObjectCommand({
      Bucket: config.bucket,
      Key: targetKey,
      CopySource: `${config.bucket}/${source}`,
    }),
  );
}

/**
 * A short-lived link to download an object. The response headers are signed
 * in, so the storage service answers with the disposition and type chosen here.
 */
export function createAssetDownloadUrl(options: {
  key: string;
  contentDisposition: string;
  contentType: string;
}) {
  const config = getStorageConfig();
  return getSignedUrl(
    getClient(config),
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: options.key,
      ResponseContentDisposition: options.contentDisposition,
      ResponseContentType: options.contentType,
    }),
    { expiresIn: DOWNLOAD_URL_TTL_SECONDS },
  );
}

/** Every object under a prefix, page by page. */
export async function* listObjects(prefix: string) {
  const config = getStorageConfig();
  const client = getClient(config);
  let token: string | undefined;
  do {
    const page = await client.send(
      new ListObjectsV2Command({
        Bucket: config.bucket,
        Prefix: prefix,
        ContinuationToken: token,
      }),
    );
    for (const object of page.Contents ?? []) {
      if (object.Key && object.LastModified) {
        yield { key: object.Key, lastModified: object.LastModified };
      }
    }
    token = page.NextContinuationToken;
  } while (token);
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
