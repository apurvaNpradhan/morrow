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
import { addWorkspaceMember } from "./helpers/add-workspace-member";
import {
  assetRow,
  objectExists,
  pngBytes,
  uploadAsset,
} from "./helpers/assets";
import { resetTestDatabase } from "./helpers/database";
import { as, rejection } from "./helpers/projects";
import { setupTasks } from "./helpers/tasks";
import { waitFor } from "./helpers/wait-for";

beforeAll(startJobs);
afterAll(() => stopJobs());
beforeEach(resetTestDatabase);

async function setup() {
  const context = await setupTasks();
  const task = await context.addTask("To Do", { title: "With a file" });
  const target = { ...context.base, taskId: task.id };
  const assetId = await uploadAsset(context.client, context.workspace.id, {
    filename: "shot.png",
    contentType: "image/png",
    bytes: pngBytes(),
  });
  await context.client.assets.finalize({
    workspaceId: context.workspace.id,
    assetId,
  });
  await context.client.tasks.updateDescription({
    ...target,
    description: `![shot.png](/api/asset/${assetId}?w=1200&h=800)`,
  });
  return { ...context, task, target, assetId };
}

describe("deleting an attachment", () => {
  it("removes the row, frees the object and returns the txid", async () => {
    const { client, target, assetId } = await setup();
    const { objectKey } = (await assetRow(assetId))!;

    const result = await client.tasks.deleteAttachment({ ...target, assetId });

    expect(typeof result.txid).toBe("number");
    expect(await assetRow(assetId)).toBeUndefined();
    await waitFor(async () => ((await objectExists(objectKey)) ? null : true));
  });

  it("leaves the text alone: the link just stops showing", async () => {
    const { client, target, assetId, task } = await setup();

    await client.tasks.deleteAttachment({ ...target, assetId });

    const [row] = await db
      .select({ description: schema.taskDescriptionTable.description })
      .from(schema.taskDescriptionTable)
      .where(eq(schema.taskDescriptionTable.taskId, task.id));
    expect(row?.description).toContain(`/api/asset/${assetId}`);
  });

  it("needs the right to edit the task", async () => {
    const { workspace, target, assetId } = await setup();
    const viewer = as(await addWorkspaceMember(workspace.id, "viewer"));

    const refused = await rejection(
      viewer.tasks.deleteAttachment({ ...target, assetId }),
    );

    expect(refused.code).toBe("FORBIDDEN");
    expect(await assetRow(assetId)).toBeDefined();
  });

  it("only deletes a file of that task", async () => {
    const { client, base, addTask, assetId } = await setup();
    const other = await addTask("To Do", { title: "Another" });

    const refused = await rejection(
      client.tasks.deleteAttachment({ ...base, taskId: other.id, assetId }),
    );

    expect(refused.data?.code).toBe("ASSET_NOT_FOUND");
    expect(await assetRow(assetId)).toBeDefined();
  });

  it("is refused in an archived project", async () => {
    const { client, base, target, assetId } = await setup();
    await client.projects.archive(base);

    const refused = await rejection(
      client.tasks.deleteAttachment({ ...target, assetId }),
    );

    expect(refused.data?.code).toBe("PROJECT_ARCHIVED");
  });
});
