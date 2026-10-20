import {
  DeleteObjectCommand,
  HeadObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { eq } from "drizzle-orm";
import type { RouterClient } from "@orpc/server";
import { db, schema } from "../../../apps/api/src/platform/database";
import type { AppRouter } from "../../../apps/api/src/platform/orpc/router";

export const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: "us-east-1",
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});

const u32be = (n: number) => [
  (n >>> 24) & 0xff,
  (n >>> 16) & 0xff,
  (n >>> 8) & 0xff,
  n & 0xff,
];

/** A PNG header with a size, padded with zeros to `total` bytes. */
export function pngBytes(width = 1200, height = 800, total = 64) {
  const bytes = new Uint8Array(Math.max(total, 33));
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  bytes.set(u32be(13), 8);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  bytes.set(u32be(width), 16);
  bytes.set(u32be(height), 20);
  return bytes;
}

export const pdfBytes = () =>
  new TextEncoder().encode("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n");

type Client = RouterClient<AppRouter>;

/** Asks for an upload, PUTs the bytes to the presigned URL, and returns the asset id. */
export async function uploadAsset(
  client: Client,
  workspaceId: string,
  file: { filename: string; contentType: string; bytes: Uint8Array },
) {
  const upload = await client.assets.createUpload({
    workspaceId,
    filename: file.filename,
    contentType: file.contentType,
    size: file.bytes.length,
  });
  const response = await fetch(upload.uploadUrl, {
    method: "PUT",
    headers: upload.headers,
    body: file.bytes,
  });
  if (!response.ok) throw new Error(`PUT failed: ${response.status}`);
  return upload.assetId;
}

export async function assetRow(id: string) {
  const [row] = await db
    .select()
    .from(schema.assetTable)
    .where(eq(schema.assetTable.id, id));
  return row;
}

export const objectExists = (key: string) =>
  s3
    .send(new HeadObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: key }))
    .then(
      () => true,
      () => false,
    );

export const removeObject = (key: string) =>
  s3.send(
    new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: key }),
  );
