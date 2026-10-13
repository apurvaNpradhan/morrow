import {
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { ORPCError } from "@orpc/client";
import { eq } from "drizzle-orm";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vite-plus/test";
import { db, schema } from "../../apps/api/src/platform/database";
import { createApp } from "../../apps/api/src/index";
import { deleteAccountData } from "../../apps/api/src/account";
import { startJobs, stopJobs } from "../../apps/api/src/platform/jobs";
import { signUpWithSession } from "./helpers/auth-session";
import { resetTestDatabase } from "./helpers/database";
import { createTestClient } from "./helpers/orpc";
import { waitFor } from "./helpers/wait-for";

const PUBLIC_BASE = process.env.S3_PUBLIC_BASE_URL!;
const BUCKET = process.env.S3_BUCKET!;
const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: "us-east-1",
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});

const PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4,
]);
const png = () => new File([PNG], "me.png", { type: "image/png" });
const keyOf = (url: string) => url.slice(PUBLIC_BASE.length + 1);
const exists = (key: string) =>
  s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key })).then(
    () => true,
    () => false,
  );

async function userImage(userId: string) {
  const [row] = await db
    .select({ image: schema.userTable.image })
    .from(schema.userTable)
    .where(eq(schema.userTable.id, userId));
  return row?.image ?? null;
}

async function codeOf(promise: Promise<unknown>) {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ORPCError);
  return (error as ORPCError<string, { code?: string }>).data?.code;
}

async function signedIn() {
  const { app } = createApp();
  const { userId, cookies } = await signUpWithSession(app, {
    email: "ada@example.com",
    name: "Ada",
  });
  return { userId, client: createTestClient(app, { cookie: cookies }) };
}

beforeAll(startJobs);
afterAll(() => stopJobs());
beforeEach(async () => {
  await resetTestDatabase();
  const listed = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET }));
  for (const object of listed.Contents ?? []) {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: object.Key }));
  }
});

describe("account avatar", () => {
  it("stores the picture and points user.image at it, replacing the old object", async () => {
    const { client, userId } = await signedIn();

    const first = await client.account.uploadAvatar({ file: png() });
    expect(first.url).toMatch(
      new RegExp(`^${PUBLIC_BASE}/avatars/${userId}/[a-z0-9]+\\.png$`),
    );
    expect(await userImage(userId)).toBe(first.url);

    const second = await client.account.uploadAvatar({ file: png() });
    expect(second.url).not.toBe(first.url);
    expect(await exists(keyOf(first.url))).toBe(false);
    expect(await exists(keyOf(second.url))).toBe(true);
  });

  it("decides the type from the bytes and enforces the size limit", async () => {
    const { client, userId } = await signedIn();
    const text = new File(["not an image"], "me.png", { type: "image/png" });
    expect(await codeOf(client.account.uploadAvatar({ file: text }))).toBe(
      "IMAGE_UNSUPPORTED_TYPE",
    );
    const big = new Uint8Array(512 * 1024 + 1);
    big.set(PNG);
    expect(
      await codeOf(
        client.account.uploadAvatar({
          file: new File([big], "me.png", { type: "image/png" }),
        }),
      ),
    ).toBe("IMAGE_TOO_LARGE");
    expect(await userImage(userId)).toBeNull();
  });

  it("removes the object and clears user.image", async () => {
    const { client, userId } = await signedIn();
    const { url } = await client.account.uploadAvatar({ file: png() });

    expect(await client.account.removeAvatar()).toEqual({ deleted: true });

    expect(await userImage(userId)).toBeNull();
    expect(await exists(keyOf(url))).toBe(false);
  });

  it("queues the avatar when the account's data is deleted, and the job removes it", async () => {
    const { client, userId } = await signedIn();
    const { url } = await client.account.uploadAvatar({ file: png() });

    await deleteAccountData(userId);

    await waitFor(async () => ((await exists(keyOf(url))) ? null : true));
  });
});
