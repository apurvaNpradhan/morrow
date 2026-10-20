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
import { startJobs, stopJobs } from "../../apps/api/src/platform/jobs";
import {
  cleanupDraftUploads,
  sweepOrphanedAssets,
} from "../../apps/api/src/storage";
import {
  assetRow,
  objectExists,
  pngBytes,
  s3,
  uploadAsset,
} from "./helpers/assets";
import { resetTestDatabase } from "./helpers/database";
import { setupTasks } from "./helpers/tasks";
import { waitFor } from "./helpers/wait-for";
import { PutObjectCommand } from "@aws-sdk/client-s3";

beforeAll(startJobs);
afterAll(() => stopJobs());
beforeEach(resetTestDatabase);

const DAY = 24 * 60 * 60 * 1000;
const png = { filename: "a.png", contentType: "image/png", bytes: pngBytes() };

async function draftAndAttached() {
  const context = await setupTasks();
  const task = await context.addTask("To Do");
  const upload = () => uploadAsset(context.client, context.workspace.id, png);
  const draft = await upload();
  const fresh = await upload();
  const attached = await upload();
  await db
    .update(schema.assetTable)
    .set({ taskId: task.id, attachedAt: new Date() })
    .where(eq(schema.assetTable.id, attached));
  return { ...context, task, draft, fresh, attached };
}

const age = (id: string, ms: number) =>
  db
    .update(schema.assetTable)
    .set({ createdAt: new Date(Date.now() - ms) })
    .where(eq(schema.assetTable.id, id));

describe("expiring drafts", () => {
  it("deletes drafts older than a day with their objects, and keeps the rest", async () => {
    const { draft, fresh, attached } = await draftAndAttached();
    const draftKey = (await assetRow(draft))!.objectKey;
    const attachedKey = (await assetRow(attached))!.objectKey;
    await age(draft, 2 * DAY);
    await age(attached, 2 * DAY);

    await cleanupDraftUploads();

    expect(await assetRow(draft)).toBeUndefined();
    expect(await assetRow(fresh)).toBeDefined();
    expect(await assetRow(attached)).toBeDefined();
    await waitFor(async () => ((await objectExists(draftKey)) ? null : true));
    expect(await objectExists(attachedKey)).toBe(true);
  });
});

describe("sweeping orphaned objects", () => {
  it("deletes old objects without a row and keeps fresh ones and those with a row", async () => {
    const { workspace, attached } = await draftAndAttached();
    const prefix = `assets/${workspace.id}`;
    const put = async (name: string) => {
      const Key = `${prefix}/${name}`;
      await s3.send(
        new PutObjectCommand({
          Bucket: process.env.S3_BUCKET!,
          Key,
          Body: "x",
        }),
      );
      return Key;
    };
    const orphan = await put("orphan-asset-id");
    const keptKey = (await assetRow(attached))!.objectKey;

    // Nothing is a day old yet.
    await sweepOrphanedAssets();
    expect(await objectExists(orphan)).toBe(true);

    await sweepOrphanedAssets(new Date(Date.now() + 2 * DAY));

    await waitFor(async () => ((await objectExists(orphan)) ? null : true));
    expect(await objectExists(keptKey)).toBe(true);
  });
});
