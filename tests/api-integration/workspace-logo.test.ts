import {
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { db, schema } from "../../apps/api/src/platform/database";
import { createApp } from "../../apps/api/src/index";
import { resetTestDatabase } from "./helpers/database";
import { createTestClient } from "./helpers/orpc";
import { signInWithOtp } from "./helpers/otp";

const origin = "http://localhost:5173";
const { app } = createApp();

async function post(path: string, body: unknown, cookie = "") {
  return app.request(`/api/auth${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Origin: origin,
      Cookie: cookie,
    },
    body: JSON.stringify(body),
  });
}

/** Signs a real user in and returns a typed client acting as them. */
async function signUp(address: string) {
  const result = await signInWithOtp(
    (path, body, headers) => post(path, body, headers?.cookie),
    address,
    { name: address.split("@")[0] },
  );
  expect(result.status).toBe(200);
  const body = await result.json();
  const cookie = result.headers
    .getSetCookie()
    .map((entry) => entry.split(";")[0])
    .join("; ");
  return {
    id: body.user.id as string,
    cookie,
    client: createTestClient(app, { cookie }),
  };
}

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
const png = () => new File([PNG], "logo.png", { type: "image/png" });
const keyOf = (url: string) => url.slice(PUBLIC_BASE.length + 1);
const exists = (key: string) =>
  s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key })).then(
    () => true,
    () => false,
  );

async function logoOf(workspaceId: string) {
  const [row] = await db
    .select({ logo: schema.workspaceTable.logo })
    .from(schema.workspaceTable)
    .where(eq(schema.workspaceTable.id, workspaceId));
  return row?.logo ?? null;
}

beforeEach(async () => {
  await resetTestDatabase();
  const listed = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET }));
  for (const object of listed.Contents ?? []) {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: object.Key }));
  }
});

describe("workspace logo", () => {
  it("stores the logo, replaces the old object and removes it on request", async () => {
    const { client } = await signUp("owner@example.com");
    const { id: workspaceId } = await client.workspace.create({
      name: "Alpha",
      slug: "alpha",
    });

    const first = await client.workspace.uploadLogo({
      workspaceId,
      file: png(),
    });
    expect(first.url).toMatch(
      new RegExp(
        `^${PUBLIC_BASE}/workspace-logos/${workspaceId}/[a-z0-9]+\\.png$`,
      ),
    );
    expect(await logoOf(workspaceId)).toBe(first.url);

    const second = await client.workspace.uploadLogo({
      workspaceId,
      file: png(),
    });
    expect(await exists(keyOf(first.url))).toBe(false);
    expect(await exists(keyOf(second.url))).toBe(true);

    expect(await client.workspace.removeLogo({ workspaceId })).toEqual({
      deleted: true,
    });
    expect(await logoOf(workspaceId)).toBeNull();
    expect(await exists(keyOf(second.url))).toBe(false);
  });

  it("rejects non-images and people who cannot update the workspace", async () => {
    const { client } = await signUp("owner@example.com");
    const { client: stranger } = await signUp("stranger@example.com");
    const { id: workspaceId } = await client.workspace.create({
      name: "Alpha",
      slug: "alpha",
    });

    await expect(
      client.workspace.uploadLogo({
        workspaceId,
        file: new File(["not an image"], "logo.png", { type: "image/png" }),
      }),
    ).rejects.toMatchObject({ data: { code: "IMAGE_UNSUPPORTED_TYPE" } });
    await expect(
      stranger.workspace.uploadLogo({ workspaceId, file: png() }),
    ).rejects.toMatchObject({
      code: expect.stringMatching(/^(FORBIDDEN|NOT_FOUND)$/),
    });
    expect(await logoOf(workspaceId)).toBeNull();
  });

  it("never deletes an object the workspace does not own", async () => {
    const { client: victim } = await signUp("victim@example.com");
    const avatar = await victim.account.uploadAvatar({ file: png() });
    const { client, cookie } = await signUp("owner@example.com");
    const { id: workspaceId } = await client.workspace.create({
      name: "Alpha",
      slug: "alpha",
    });

    // Better Auth must not accept a client-supplied logo...
    const response = await post(
      "/organization/update",
      { organizationId: workspaceId, data: { logo: avatar.url } },
      cookie,
    );
    expect(response.status).toBe(400);
    expect(await logoOf(workspaceId)).toBeNull();

    // ...and rows that already hold a foreign URL must not delete it either.
    await db
      .update(schema.workspaceTable)
      .set({ logo: avatar.url })
      .where(eq(schema.workspaceTable.id, workspaceId));
    await client.workspace.removeLogo({ workspaceId });
    expect(await exists(keyOf(avatar.url))).toBe(true);
  });
});
