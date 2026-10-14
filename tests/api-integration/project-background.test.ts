import {
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { deleteAccountData } from "../../apps/api/src/account";
import { createApp } from "../../apps/api/src/index";
import { startJobs, stopJobs } from "../../apps/api/src/platform/jobs";
import { addWorkspaceMember } from "./helpers/add-workspace-member";
import { signUpWithSession } from "./helpers/auth-session";
import { resetTestDatabase } from "./helpers/database";
import { createTestClient } from "./helpers/orpc";
import {
  as,
  createProject,
  projectRow,
  rejection,
  setupWorkspace,
} from "./helpers/projects";
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
const png = () => new File([PNG], "background.png", { type: "image/png" });
const keyOf = (url: string) => url.slice(PUBLIC_BASE.length + 1);
const exists = (key: string) =>
  s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key })).then(
    () => true,
    () => false,
  );

async function storedKeys() {
  const listed = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET }));
  return (listed.Contents ?? []).map((object) => object.Key!);
}

beforeAll(startJobs);
afterAll(() => stopJobs());
beforeEach(async () => {
  vi.restoreAllMocks();
  await resetTestDatabase();
  for (const key of await storedKeys()) {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  }
});

async function setup() {
  const context = await setupWorkspace();
  const project = await createProject(context.client, context.workspace.id);
  return {
    ...context,
    projectId: project.id,
    base: { workspaceId: context.workspace.id, projectId: project.id },
  };
}

describe("project background", () => {
  it("stores the image, replaces the old object and removes it on request", async () => {
    const { client, base, projectId } = await setup();

    const first = await client.projects.uploadBackground({
      ...base,
      file: png(),
    });
    expect(first.url).toMatch(
      new RegExp(
        `^${PUBLIC_BASE}/project-backgrounds/${projectId}/[a-z0-9]+\\.png$`,
      ),
    );
    expect((await projectRow(projectId))?.backgroundUrl).toBe(first.url);

    const second = await client.projects.uploadBackground({
      ...base,
      file: png(),
    });
    expect(await exists(keyOf(first.url))).toBe(false);
    expect(await exists(keyOf(second.url))).toBe(true);

    expect(await client.projects.removeBackground(base)).toMatchObject({
      deleted: true,
    });
    expect((await projectRow(projectId))?.backgroundUrl).toBeNull();
    expect(await exists(keyOf(second.url))).toBe(false);
  });

  it("reports that there was nothing to remove", async () => {
    const { client, base } = await setup();

    expect(await client.projects.removeBackground(base)).toMatchObject({
      deleted: false,
    });
  });

  it("rejects non-images", async () => {
    const { client, base, projectId } = await setup();

    const error = await rejection(
      client.projects.uploadBackground({
        ...base,
        file: new File(["not an image"], "background.png", {
          type: "image/png",
        }),
      }),
    );

    expect(error.data?.code).toBe("IMAGE_UNSUPPORTED_TYPE");
    expect((await projectRow(projectId))?.backgroundUrl).toBeNull();
  });

  it("refuses viewers, and leaves nothing in storage", async () => {
    const { workspace, base } = await setup();
    const viewer = await addWorkspaceMember(workspace.id, "viewer");

    const error = await rejection(
      as(viewer).projects.uploadBackground({ ...base, file: png() }),
    );

    expect(error.code).toBe("FORBIDDEN");
    expect(await storedKeys()).toEqual([]);
  });

  it("refuses an archived project and removes the object it had just stored", async () => {
    const { client, base } = await setup();
    await client.projects.archive(base);

    const error = await rejection(
      client.projects.uploadBackground({ ...base, file: png() }),
    );

    expect(error.data?.code).toBe("PROJECT_ARCHIVED");
    await waitFor(async () =>
      (await storedKeys()).length === 0 ? true : null,
    );
  });

  it("deletes the image with the project", async () => {
    const { client, base } = await setup();
    const { url } = await client.projects.uploadBackground({
      ...base,
      file: png(),
    });
    await client.projects.archive(base);

    await client.projects.remove(base);

    expect(await exists(keyOf(url))).toBe(false);
  });

  it("deletes the images of every project when the workspace is deleted", async () => {
    // A real session: deleting a workspace goes through Better Auth.
    const { app } = createApp();
    const { cookies } = await signUpWithSession(app, {
      email: "owner@example.com",
      name: "Owner",
    });
    const client = createTestClient(app, { cookie: cookies });
    const { id: workspaceId } = await client.workspace.create({
      name: "Alpha",
      slug: "alpha",
    });
    const urls: string[] = [];
    for (const key of ["ONE", "TWO"]) {
      const { id } = await client.projects.create({
        workspaceId,
        name: key,
        key,
      });
      const { url } = await client.projects.uploadBackground({
        workspaceId,
        projectId: id,
        file: png(),
      });
      urls.push(url);
    }
    expect(await storedKeys()).toHaveLength(2);

    await client.workspace.remove({ workspaceId });

    await waitFor(async () =>
      (await storedKeys()).length === 0 ? true : null,
    );
    for (const url of urls) expect(await exists(keyOf(url))).toBe(false);
  });

  it("deletes the images of the workspaces an account deletion removes", async () => {
    const { app } = createApp();
    const { userId, cookies } = await signUpWithSession(app, {
      email: "leaver@example.com",
      name: "Leaver",
    });
    const client = createTestClient(app, { cookie: cookies });
    const { id: workspaceId } = await client.workspace.create({
      name: "Solo",
      slug: "solo",
    });
    const { id } = await client.projects.create({
      workspaceId,
      name: "Only",
      key: "ONL",
    });
    const { url } = await client.projects.uploadBackground({
      workspaceId,
      projectId: id,
      file: png(),
    });

    await deleteAccountData(userId);

    await waitFor(async () => ((await exists(keyOf(url))) ? null : true));
  });
});
