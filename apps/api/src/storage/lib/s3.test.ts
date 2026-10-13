import {
  DeleteObjectCommand,
  HeadObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import {
  applyKeyPrefix,
  assertDraftAssetKeyMatchesContext,
  assertStorageConfigured,
  buildDraftAssetObjectKey,
  buildDraftAssetObjectKeyPrefix,
  createDraftAssetUploadUrl,
  getFileExtension,
  InvalidUploadedAssetError,
  isImageContentType,
  resolveS3Credentials,
  sanitizePathSegment,
  validateDraftAssetUploadInput,
  verifyDraftAssetUpload,
} from "./s3";

const trackedKeys = [
  "S3_ENDPOINT",
  "S3_BUCKET",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "S3_REGION",
  "S3_FORCE_PATH_STYLE",
  "S3_KEY_PREFIX",
  "S3_MAX_IMAGE_UPLOAD_BYTES",
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
  vi.restoreAllMocks();
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

const uploadContext = {
  workspaceId: "workspace-1",
  userId: "user-1",
  surface: "draft" as const,
  filename: "report.png",
  contentType: "image/png",
};

describe("S3 draft asset helpers", () => {
  it("recognizes allowed image content types case-insensitively", () => {
    expect(isImageContentType("IMAGE/PNG")).toBe(true);
    expect(isImageContentType("text/plain")).toBe(false);
  });

  it("sanitizes path segments and extracts normalized extensions", () => {
    expect(sanitizePathSegment(" Release Notes!!.PNG ")).toBe(
      "release-notes-.png",
    );
    expect(sanitizePathSegment("")).toBe("file");
    expect(getFileExtension("Screenshot.Final.PNG")).toBe("png");
    expect(getFileExtension("README")).toBe("file");
  });

  it("builds keys inside the workspace and uploader scope", () => {
    const context = {
      ...uploadContext,
      workspaceId: "Workspace 1",
      userId: "User 2",
    };
    expect(buildDraftAssetObjectKeyPrefix(context)).toBe(
      "workspace/workspace-1/user/user-2/draft",
    );
    expect(buildDraftAssetObjectKey(context)).toMatch(
      /^workspace\/workspace-1\/user\/user-2\/draft\/report-\d+-[a-z0-9]+\.png$/,
    );
  });

  it("only accepts a draft key for the matching workspace and uploader", () => {
    configureS3();
    process.env.S3_KEY_PREFIX = "staging";
    const context = {
      workspaceId: "workspace-1",
      userId: "user-1",
      surface: "draft" as const,
    };
    const key =
      "staging/workspace/workspace-1/user/user-1/draft/image-123-abc.png";
    expect(assertDraftAssetKeyMatchesContext(key, context)).toBe(true);
    expect(
      assertDraftAssetKeyMatchesContext(key, { ...context, userId: "user-2" }),
    ).toBe(false);
    expect(
      assertDraftAssetKeyMatchesContext(key, {
        ...context,
        workspaceId: "workspace-2",
      }),
    ).toBe(false);
    expect(
      assertDraftAssetKeyMatchesContext(`${key}/../../other.png`, context),
    ).toBe(false);
    expect(
      assertDraftAssetKeyMatchesContext(`${key}/nested.png`, context),
    ).toBe(false);
    expect(assertDraftAssetKeyMatchesContext(`${key}/.hidden`, context)).toBe(
      false,
    );
  });

  it("prepends an optional key prefix safely", () => {
    expect(applyKeyPrefix("", "workspace/a/file.png")).toBe(
      "workspace/a/file.png",
    );
    expect(applyKeyPrefix("prod/morrow///", "key")).toBe("prod/morrow/key");
  });

  it("validates upload type, positive safe size, and configured maximum", () => {
    process.env.S3_MAX_IMAGE_UPLOAD_BYTES = "1048576";
    expect(() => validateDraftAssetUploadInput("", 10)).toThrow(
      "A valid content type is required.",
    );
    expect(() => validateDraftAssetUploadInput("application/pdf", 10)).toThrow(
      'Unsupported content type "application/pdf"',
    );
    for (const size of [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      -1,
      0,
      0.5,
      Number.MAX_SAFE_INTEGER + 1,
    ]) {
      expect(() => validateDraftAssetUploadInput("image/png", size)).toThrow(
        "Upload size must be a positive safe integer.",
      );
    }
    expect(() => validateDraftAssetUploadInput("image/png", 1048577)).toThrow(
      "Upload exceeds the maximum upload size of 1MB.",
    );
    expect(() =>
      validateDraftAssetUploadInput("image/png", 1024),
    ).not.toThrow();
  });

  it("binds upload URLs to the declared content type and length", async () => {
    configureS3();
    process.env.S3_KEY_PREFIX = "uploads";
    const upload = await createDraftAssetUploadUrl({
      ...uploadContext,
      size: 12345,
    });
    expect(upload.key).toMatch(
      /^uploads\/workspace\/workspace-1\/user\/user-1\/draft\//,
    );
    expect(upload.headers).toEqual({ "Content-Type": "image/png" });
    const params = new URL(upload.uploadUrl).searchParams;
    expect(params.get("X-Amz-SignedHeaders")).toContain("content-length");
    expect(params.get("X-Amz-SignedHeaders")).toContain("content-type");
    expect(params.has("x-amz-checksum-crc32")).toBe(false);
  });

  it("rejects uploaded objects that do not match the declared size and type", async () => {
    configureS3();
    vi.spyOn(S3Client.prototype, "send").mockResolvedValue({
      ContentLength: 11,
      ContentType: "image/jpeg",
    } as never);
    await expect(
      verifyDraftAssetUpload("key", { size: 10, contentType: "image/png" }),
    ).rejects.toBeInstanceOf(InvalidUploadedAssetError);
  });

  it("removes uploaded objects that exceed the configured maximum", async () => {
    configureS3();
    process.env.S3_MAX_IMAGE_UPLOAD_BYTES = "10";
    const send = vi.spyOn(S3Client.prototype, "send").mockResolvedValue({
      ContentLength: 11,
      ContentType: "image/png",
    } as never);
    await expect(
      verifyDraftAssetUpload("key", { size: 11, contentType: "image/png" }),
    ).rejects.toThrow("exceeds the maximum");
    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(HeadObjectCommand);
    expect(send.mock.calls[1]?.[0]).toBeInstanceOf(DeleteObjectCommand);
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

  it("requires endpoint and bucket, and allows IAM role mode", () => {
    process.env.S3_ENDPOINT = "https://s3.example.test";
    process.env.S3_BUCKET = "morrow";
    expect(assertStorageConfigured()).toMatchObject({
      bucket: "morrow",
      accessKeyId: "",
      secretAccessKey: "",
    });
    delete process.env.S3_ENDPOINT;
    delete process.env.S3_BUCKET;
    expect(() => assertStorageConfigured()).toThrow(
      /S3 uploads are not configured/,
    );
  });
});
