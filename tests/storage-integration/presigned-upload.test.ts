import { request } from "node:http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import {
  CreateBucketCommand,
  DeleteBucketCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "../../apps/api/node_modules/@aws-sdk/client-s3";
import {
  assetObjectKey,
  copyAssetObject,
  createAssetUploadUrl,
  deleteS3Object,
  headAssetObject,
  readAssetHead,
} from "../../apps/api/src/storage/lib/s3";

// biome-ignore lint/suspicious/noUndeclaredEnvVars: This opt-in suite runs directly in Vitest, outside Turbo's task cache.
const endpoint = process.env.MORROW_STORAGE_TEST_ENDPOINT;
if (
  !endpoint ||
  new URL(endpoint).hostname !== "127.0.0.1" ||
  new URL(endpoint).protocol !== "http:"
) {
  throw new Error(
    "Set MORROW_STORAGE_TEST_ENDPOINT to the disposable loopback S3 service (http://127.0.0.1:PORT). Real storage endpoints are not allowed.",
  );
}
const bucket = `morrow-security-${Date.now()}-test`;
const client = new S3Client({
  endpoint,
  region: "us-east-1",
  forcePathStyle: true,
  credentials: {
    accessKeyId: "local-test-access",
    secretAccessKey: "local-test-secret-only",
  },
});

beforeAll(async () => {
  vi.stubEnv("S3_ENDPOINT", endpoint);
  vi.stubEnv("S3_BUCKET", bucket);
  vi.stubEnv("S3_ACCESS_KEY_ID", "local-test-access");
  vi.stubEnv("S3_SECRET_ACCESS_KEY", "local-test-secret-only");
  vi.stubEnv("S3_REGION", "us-east-1");
  vi.stubEnv("S3_FORCE_PATH_STYLE", "true");
  vi.stubEnv("S3_KEY_PREFIX", "");
  await client.send(new CreateBucketCommand({ Bucket: bucket }));
});
afterAll(async () => {
  try {
    const objects = await client.send(
      new ListObjectsV2Command({ Bucket: bucket }),
    );
    for (const object of objects.Contents ?? [])
      if (object.Key) await deleteS3Object(object.Key);
    await client.send(new DeleteBucketCommand({ Bucket: bucket }));
  } finally {
    client.destroy();
    vi.unstubAllEnvs();
  }
});

const KEY_ID = "asset-id";
async function presign(size = 12, contentType = "image/png") {
  const key = assetObjectKey(
    "local",
    `${KEY_ID}-${Math.random().toString(36).slice(2)}`,
  );
  const upload = await createAssetUploadUrl({ key, size, contentType });
  return { ...upload, key };
}

describe("presigned uploads against real local S3 storage", () => {
  it("copies an object with reserved characters and survives source deletion", async () => {
    const sourceKey = "source/report #1%.png";
    const body = Buffer.from("independent attachment");
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: sourceKey,
        Body: body,
        ContentType: "image/png",
      }),
    );
    const copiedKey = assetObjectKey("local", "copy");

    await copyAssetObject(sourceKey, copiedKey);
    await deleteS3Object(sourceKey);

    const copied = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: copiedKey }),
    );
    expect(copied.ContentType).toBe("image/png");
    expect(await copied.Body?.transformToByteArray()).toEqual(
      new Uint8Array(body),
    );
  });

  it("accepts an exact-size upload and reports its size", async () => {
    const upload = await presign(64);
    const response = await fetch(upload.uploadUrl, {
      method: "PUT",
      headers: upload.headers,
      body: new Uint8Array(64),
    });
    expect(response.status).toBe(200);
    expect(await headAssetObject(upload.key)).toEqual({ size: 64 });
  });

  it.each([1, 13, 65, 4096])(
    "rejects a body of %i bytes signed for 12 bytes without storing it",
    async (size) => {
      const upload = await presign();
      const response = await fetch(upload.uploadUrl, {
        method: "PUT",
        headers: upload.headers,
        body: new Uint8Array(size),
      });
      expect(response.status).toBe(403);
      await response.body?.cancel();
      expect(await headAssetObject(upload.key)).toBeNull();
    },
  );

  it("rejects a changed Content-Type without storing the object", async () => {
    const upload = await presign();
    const response = await fetch(upload.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "text/html" },
      body: new Uint8Array(12),
    });
    expect(response.status).toBe(403);
    await response.body?.cancel();
    expect(await headAssetObject(upload.key)).toBeNull();
  });

  it("rejects unsigned chunked transfer without Content-Length", async () => {
    const upload = await presign();
    const status = await new Promise<number>((resolve, reject) => {
      const req = request(
        upload.uploadUrl,
        {
          method: "PUT",
          headers: { ...upload.headers, "transfer-encoding": "chunked" },
        },
        (response) => {
          response.resume();
          response.on("end", () => resolve(response.statusCode ?? 0));
        },
      );
      req.on("error", reject);
      req.end(Buffer.alloc(4096));
    });
    expect(status).toBeGreaterThanOrEqual(400);
    expect(status).toBeLessThan(500);
    expect(await headAssetObject(upload.key)).toBeNull();
  });

  it("reads only the start of an object", async () => {
    const key = assetObjectKey("local", "ranged");
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: Buffer.from("0123456789"),
      }),
    );
    expect(new TextDecoder().decode(await readAssetHead(key, 4))).toBe("0123");
  });
});
