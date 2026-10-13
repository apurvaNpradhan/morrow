import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vite-plus/test";
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
const keyOf = (url: string) => url.slice(PUBLIC_BASE.length + 1);
const exists = (key: string) =>
  s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key })).then(
    () => true,
    () => false,
  );

async function uploadedAvatar() {
  const { app } = createApp();
  const { userId, cookies } = await signUpWithSession(app, {
    email: "jobs@example.com",
    name: "Jobs",
  });
  const client = createTestClient(app, { cookie: cookies });
  const { url } = await client.account.uploadAvatar({
    file: new File([PNG], "me.png", { type: "image/png" }),
  });
  return { userId, key: keyOf(url) };
}

beforeAll(startJobs);
afterAll(() => stopJobs());
beforeEach(resetTestDatabase);

describe("storage delete jobs", () => {
  it("removes an account's avatar through the queue", async () => {
    const { userId, key } = await uploadedAvatar();
    expect(await exists(key)).toBe(true);

    await deleteAccountData(userId);

    await waitFor(async () => ((await exists(key)) ? null : true));
  });
});
