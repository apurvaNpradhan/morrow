import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import {
  applyKeyPrefix,
  assetObjectKey,
  createAssetDownloadUrl,
  createAssetUploadUrl,
  isStorageConfigured,
  resolveS3Credentials,
} from "./s3";

const trackedKeys = [
  "S3_ENDPOINT",
  "S3_BUCKET",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "S3_REGION",
  "S3_FORCE_PATH_STYLE",
  "S3_KEY_PREFIX",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_SESSION_TOKEN",
] as const;
const original: Partial<Record<(typeof trackedKeys)[number], string>> = {};

beforeEach(() => {
  for (const key of trackedKeys) {
    original[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of trackedKeys) {
    const value = original[key];
    if (value === undefined) delete process.env[key];
    else (process.env as Record<string, string>)[key] = value;
  }
});

function configureS3() {
  process.env.S3_ENDPOINT = "https://storage.example.test";
  process.env.S3_BUCKET = "morrow";
  process.env.S3_ACCESS_KEY_ID = "test-access-key";
  process.env.S3_SECRET_ACCESS_KEY = "test-secret-key";
  process.env.S3_REGION = "us-east-1";
  process.env.S3_FORCE_PATH_STYLE = "true";
}

describe("S3 helpers", () => {
  it("prepends an optional key prefix safely", () => {
    expect(applyKeyPrefix("", "assets/a/b")).toBe("assets/a/b");
    expect(applyKeyPrefix("prod/morrow///", "key")).toBe("prod/morrow/key");
  });

  it("keeps asset objects under assets/<workspace>/<asset>, after the key prefix", () => {
    expect(assetObjectKey("ws1", "as1")).toBe("assets/ws1/as1");
    process.env.S3_KEY_PREFIX = "staging";
    expect(assetObjectKey("ws1", "as1")).toBe("staging/assets/ws1/as1");
  });

  it("supports IAM role credentials and rejects incomplete static credentials", () => {
    expect(resolveS3Credentials("AKIA", "secret")).toEqual({
      accessKeyId: "AKIA",
      secretAccessKey: "secret",
    });
    expect(resolveS3Credentials("", "")).toBeUndefined();
    expect(() => resolveS3Credentials("AKIA", "")).toThrow(
      /both S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY/,
    );
  });

  it("is configured with an endpoint and a bucket, and IAM role mode needs no keys", () => {
    expect(isStorageConfigured()).toBe(false);
    process.env.S3_ENDPOINT = "https://s3.example.test";
    process.env.S3_BUCKET = "morrow";
    expect(isStorageConfigured()).toBe(true);
  });

  it("binds an upload URL to the declared content type and length", async () => {
    configureS3();
    const upload = await createAssetUploadUrl({
      key: "assets/ws1/as1",
      size: 12345,
      contentType: "application/zip",
    });
    expect(upload.headers).toEqual({ "Content-Type": "application/zip" });
    const params = new URL(upload.uploadUrl).searchParams;
    expect(params.get("X-Amz-SignedHeaders")).toContain("content-length");
    expect(params.get("X-Amz-SignedHeaders")).toContain("content-type");
    expect(params.has("x-amz-checksum-crc32")).toBe(false);
  });

  it("signs the response disposition and type into a download URL that expires quickly", async () => {
    configureS3();
    const url = new URL(
      await createAssetDownloadUrl({
        key: "assets/ws1/as1",
        contentDisposition: 'attachment; filename="a.zip"',
        contentType: "application/octet-stream",
      }),
    );
    expect(url.searchParams.get("response-content-disposition")).toBe(
      'attachment; filename="a.zip"',
    );
    expect(url.searchParams.get("response-content-type")).toBe(
      "application/octet-stream",
    );
    expect(url.searchParams.get("X-Amz-Expires")).toBe("60");
  });
});
