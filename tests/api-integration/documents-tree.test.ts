import * as decoding from "lib0/decoding";
import { eq, sql } from "drizzle-orm";
import * as Y from "yjs";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vite-plus/test";
import { deletePageStream } from "../../apps/api/src/documents/lib/yjs-streams";
import { rebuildDocumentStreams } from "../../apps/api/src/documents/lib/rebuild-streams";
import { db, schema } from "../../apps/api/src/platform/database";
import { addWorkspaceMember } from "./helpers/add-workspace-member";
import { resetTestDatabase } from "./helpers/database";
import {
  documentFactory,
  documentRow,
  documentRows,
  newDocumentId,
} from "./helpers/documents";
import { startPageStreams } from "./helpers/page-streams";
import {
  as,
  createProject,
  rejection,
  setupWorkspace,
} from "./helpers/projects";
import { positionAt } from "./helpers/tasks";

let streams: Awaited<ReturnType<typeof startPageStreams>>;
beforeAll(async () => {
  streams = await startPageStreams();
});
afterAll(() => streams.stop());
beforeEach(resetTestDatabase);

async function setup() {
  const context = await setupWorkspace();
  const addDocument = documentFactory(context.client, context.workspace.id);
  const base = { workspaceId: context.workspace.id };
  return { ...context, addDocument, base };
}

const streamExists = async (id: string, generation = 1) =>
  (
    await fetch(`${streams.yjsUrl}/v1/yjs/morrow/docs/${id}/g${generation}`, {
      method: "HEAD",
    })
  ).ok;

async function xminOfDocument(id: string) {
  const rows = await db.execute<{ xmin: string }>(
    sql`SELECT xmin::text AS xmin FROM documents WHERE id = ${id}`,
  );
  return Number(rows.rows[0]?.xmin);
}

describe("creating a page", () => {
  it("stores what the client chose, returns the txid and creates the stream", async () => {
    const { client, workspace, owner } = await setup();
    const id = newDocumentId();

    const created = await client.documents.create({
      workspaceId: workspace.id,
      id,
      projectId: null,
      parentId: null,
      position: positionAt(0),
      title: "  Plan  ",
    });

    expect(created.txid).toBe(await xminOfDocument(id));
    expect(await documentRow(id)).toMatchObject({
      workspaceId: workspace.id,
      projectId: null,
      parentId: null,
      title: "Plan",
      generation: 1,
      overLimit: false,
      archivedAt: null,
      createdBy: owner.id,
    });
    expect(await streamExists(id)).toBe(true);
  });

  it("registers the client id that wrote the empty document", async () => {
    const { addDocument } = await setup();
    const { id } = await addDocument();

    const clients = await db
      .select()
      .from(schema.documentClientTable)
      .where(eq(schema.documentClientTable.documentId, id));

    expect(clients).toHaveLength(1);
    expect(clients[0]).toMatchObject({ via: "system" });
  });

  it("nests under a page, in a project, and at the top of a project", async () => {
    const { client, workspace, addDocument } = await setup();
    const project = await createProject(client, workspace.id);
    const top = await addDocument({ projectId: project.id });
    const child = await addDocument({
      projectId: project.id,
      parentId: top.id,
    });

    expect(await documentRow(child.id)).toMatchObject({
      projectId: project.id,
      parentId: top.id,
    });
  });

  it("refuses a bad id, a bad position and a taken id", async () => {
    const { client, base, addDocument } = await setup();
    const existing = await addDocument();
    const create = (input: Record<string, unknown>) =>
      client.documents.create({
        ...base,
        id: newDocumentId(),
        projectId: null,
        parentId: null,
        position: positionAt(9),
        ...input,
      });

    expect((await rejection(create({ id: "short" }))).data?.code).toBe(
      "INVALID_DOCUMENT_ID",
    );
    expect((await rejection(create({ position: "a!" }))).data?.code).toBe(
      "INVALID_POSITION",
    );
    expect((await rejection(create({ id: existing.id }))).data?.code).toBe(
      "DOCUMENT_ID_TAKEN",
    );
  });

  it("refuses a parent in another project, an archived parent and an archived project", async () => {
    const { client, workspace, base, addDocument } = await setup();
    const first = await createProject(client, workspace.id, "AAA");
    const second = await createProject(client, workspace.id, "BBB");
    const inFirst = await addDocument({ projectId: first.id });
    const create = (input: Record<string, unknown>) =>
      client.documents.create({
        ...base,
        id: newDocumentId(),
        position: positionAt(9),
        projectId: null,
        parentId: null,
        ...input,
      });

    expect(
      (await rejection(create({ projectId: second.id, parentId: inFirst.id })))
        .data?.code,
    ).toBe("PARENT_NOT_IN_PROJECT");

    await client.documents.archive({ ...base, documentId: inFirst.id });
    expect(
      (await rejection(create({ projectId: first.id, parentId: inFirst.id })))
        .data?.code,
    ).toBe("DOCUMENT_ARCHIVED");

    await client.projects.archive({
      workspaceId: workspace.id,
      projectId: second.id,
    });
    expect((await rejection(create({ projectId: second.id }))).data?.code).toBe(
      "PROJECT_ARCHIVED",
    );
  });

  it("does not leave a page behind when its stream cannot be created", async () => {
    const { client, workspace } = await setup();
    const original = process.env.DURABLE_STREAMS_URL;
    await streams.stop();
    try {
      await rejection(
        client.documents.create({
          workspaceId: workspace.id,
          id: newDocumentId(),
          projectId: null,
          parentId: null,
          position: positionAt(0),
        }),
      );
      expect(await documentRows(workspace.id)).toEqual([]);
    } finally {
      process.env.DURABLE_STREAMS_URL = original;
      streams = await startPageStreams();
    }
  });
});

describe("page permissions", () => {
  it("lets members create and edit, and only admins delete", async () => {
    const { client, workspace, base, addDocument } = await setup();
    const viewer = as(await addWorkspaceMember(workspace.id, "viewer"));
    const member = as(await addWorkspaceMember(workspace.id, "member"));
    const admin = as(await addWorkspaceMember(workspace.id, "admin"));
    const page = await addDocument();

    const memberPage = await documentFactory(member, workspace.id)();
    await member.documents.update({
      ...base,
      documentId: page.id,
      title: "Renamed",
    });
    expect(
      (
        await rejection(
          viewer.documents.update({ ...base, documentId: page.id, title: "x" }),
        )
      ).code,
    ).toBe("FORBIDDEN");
    expect(
      (await rejection(documentFactory(viewer, workspace.id)())).code,
    ).toBe("FORBIDDEN");
    expect(
      (
        await rejection(
          member.documents.delete({ ...base, documentId: memberPage.id }),
        )
      ).code,
    ).toBe("FORBIDDEN");
    await admin.documents.delete({ ...base, documentId: memberPage.id });
    await client.documents.delete({ ...base, documentId: page.id });

    expect(await documentRows(workspace.id)).toEqual([]);
  });

  it("does not reach a page of another Workspace", async () => {
    const mine = await setup();
    const theirs = await setup();
    const theirPage = await theirs.addDocument();

    const attempts = [
      mine.client.documents.update({
        ...mine.base,
        documentId: theirPage.id,
        title: "x",
      }),
      mine.client.documents.archive({ ...mine.base, documentId: theirPage.id }),
      mine.client.documents.restore({ ...mine.base, documentId: theirPage.id }),
      mine.client.documents.delete({ ...mine.base, documentId: theirPage.id }),
      mine.client.documents.move({
        ...mine.base,
        documentId: theirPage.id,
        parentId: null,
        projectId: null,
        position: positionAt(3),
      }),
    ];
    for (const attempt of attempts) {
      expect((await rejection(attempt)).code).toBe("NOT_FOUND");
    }
    expect((await documentRow(theirPage.id))?.title).toBe("Page");
  });
});

describe("renaming and the icon", () => {
  it("renames, sets and clears the icon, and refuses a bad icon or a long title", async () => {
    const { client, base, addDocument } = await setup();
    const page = await addDocument();
    const update = (input: Record<string, unknown>) =>
      client.documents.update({ ...base, documentId: page.id, ...input });

    await update({ title: "Runbook", icon: "📘" });
    expect(await documentRow(page.id)).toMatchObject({
      title: "Runbook",
      icon: "📘",
    });
    await update({ icon: null });
    expect((await documentRow(page.id))?.icon).toBeNull();
    await expect(update({ icon: "not an icon" })).rejects.toBeDefined();
    await expect(update({ title: "x".repeat(201) })).rejects.toBeDefined();
  });

  it("refuses to rename an archived page or a page in an archived project", async () => {
    const { client, workspace, base, addDocument } = await setup();
    const project = await createProject(client, workspace.id);
    const archived = await addDocument();
    const inProject = await addDocument({ projectId: project.id });
    await client.documents.archive({ ...base, documentId: archived.id });
    await client.projects.archive({
      workspaceId: workspace.id,
      projectId: project.id,
    });

    expect(
      (
        await rejection(
          client.documents.update({
            ...base,
            documentId: archived.id,
            title: "x",
          }),
        )
      ).data?.code,
    ).toBe("DOCUMENT_ARCHIVED");
    expect(
      (
        await rejection(
          client.documents.update({
            ...base,
            documentId: inProject.id,
            title: "x",
          }),
        )
      ).data?.code,
    ).toBe("PROJECT_ARCHIVED");
  });
});

describe("moving a page", () => {
  it("rewrites the project of the whole subtree", async () => {
    const { client, workspace, base, addDocument } = await setup();
    const first = await createProject(client, workspace.id, "AAA");
    const second = await createProject(client, workspace.id, "BBB");
    const root = await addDocument({ projectId: first.id });
    const child = await addDocument({ projectId: first.id, parentId: root.id });
    const grandchild = await addDocument({
      projectId: first.id,
      parentId: child.id,
    });
    const other = await addDocument({ projectId: first.id });

    await client.documents.move({
      ...base,
      documentId: root.id,
      parentId: null,
      projectId: second.id,
      position: positionAt(5),
    });

    for (const id of [root.id, child.id, grandchild.id]) {
      expect((await documentRow(id))?.projectId).toBe(second.id);
    }
    expect((await documentRow(other.id))?.projectId).toBe(first.id);
    expect(await documentRow(root.id)).toMatchObject({
      parentId: null,
      position: positionAt(5),
    });
  });

  it("moves a subtree to the Workspace root and under a page of another project", async () => {
    const { client, workspace, base, addDocument } = await setup();
    const first = await createProject(client, workspace.id, "AAA");
    const second = await createProject(client, workspace.id, "BBB");
    const root = await addDocument({ projectId: first.id });
    const child = await addDocument({ projectId: first.id, parentId: root.id });
    const target = await addDocument({ projectId: second.id });

    await client.documents.move({
      ...base,
      documentId: root.id,
      parentId: null,
      projectId: null,
      position: positionAt(4),
    });
    expect((await documentRow(child.id))?.projectId).toBeNull();

    await client.documents.move({
      ...base,
      documentId: root.id,
      parentId: target.id,
      projectId: second.id,
      position: positionAt(1),
    });
    expect(await documentRow(child.id)).toMatchObject({
      projectId: second.id,
      parentId: root.id,
    });
    expect(await documentRow(root.id)).toMatchObject({
      projectId: second.id,
      parentId: target.id,
    });
  });

  it("refuses a move into the page's own subtree and onto a parent of another project", async () => {
    const { client, workspace, base, addDocument } = await setup();
    const project = await createProject(client, workspace.id);
    const root = await addDocument({ projectId: project.id });
    const child = await addDocument({
      projectId: project.id,
      parentId: root.id,
    });
    const move = (
      documentId: string,
      parentId: string | null,
      projectId: string | null,
    ) =>
      client.documents.move({
        ...base,
        documentId,
        parentId,
        projectId,
        position: positionAt(7),
      });

    expect(
      (await rejection(move(root.id, child.id, project.id))).data?.code,
    ).toBe("DOCUMENT_CYCLE");
    expect(
      (await rejection(move(root.id, root.id, project.id))).data?.code,
    ).toBe("DOCUMENT_CYCLE");
    expect((await rejection(move(child.id, root.id, null))).data?.code).toBe(
      "PARENT_NOT_IN_PROJECT",
    );
  });

  it("refuses a move into an archived subtree, an archived project and of an archived page", async () => {
    const { client, workspace, base, addDocument } = await setup();
    const open = await createProject(client, workspace.id, "AAA");
    const closed = await createProject(client, workspace.id, "BBB");
    const archivedRoot = await addDocument({ projectId: open.id });
    const archivedChild = await addDocument({
      projectId: open.id,
      parentId: archivedRoot.id,
    });
    const mover = await addDocument({ projectId: open.id });
    await client.documents.archive({ ...base, documentId: archivedRoot.id });
    await client.projects.archive({
      workspaceId: workspace.id,
      projectId: closed.id,
    });
    const move = (
      documentId: string,
      parentId: string | null,
      projectId: string | null,
    ) =>
      client.documents.move({
        ...base,
        documentId,
        parentId,
        projectId,
        position: positionAt(7),
      });

    expect(
      (await rejection(move(mover.id, archivedChild.id, open.id))).data?.code,
    ).toBe("DOCUMENT_ARCHIVED");
    expect((await rejection(move(mover.id, null, closed.id))).data?.code).toBe(
      "PROJECT_ARCHIVED",
    );
    expect(
      (await rejection(move(archivedRoot.id, null, open.id))).data?.code,
    ).toBe("DOCUMENT_ARCHIVED");
  });
});

describe("archiving and restoring", () => {
  it("archives a page and everything under it, and restores exactly that", async () => {
    const { client, base, addDocument } = await setup();
    const parent = await addDocument();
    const child = await addDocument({ parentId: parent.id });
    const grandchild = await addDocument({ parentId: child.id });
    const sibling = await addDocument();

    await client.documents.archive({ ...base, documentId: parent.id });

    for (const id of [parent.id, child.id, grandchild.id]) {
      expect(await documentRow(id)).toMatchObject({
        archivedRootId: parent.id,
      });
      expect((await documentRow(id))?.archivedAt).toBeInstanceOf(Date);
    }
    expect((await documentRow(sibling.id))?.archivedAt).toBeNull();

    await client.documents.restore({ ...base, documentId: parent.id });
    for (const id of [parent.id, child.id, grandchild.id]) {
      expect(await documentRow(id)).toMatchObject({
        archivedAt: null,
        archivedRootId: null,
      });
    }
  });

  it("keeps a sub-page archived earlier when its parent is restored", async () => {
    const { client, base, addDocument } = await setup();
    const parent = await addDocument();
    const child = await addDocument({ parentId: parent.id });
    const sibling = await addDocument({ parentId: parent.id });
    await client.documents.archive({ ...base, documentId: child.id });
    await client.documents.archive({ ...base, documentId: parent.id });

    await client.documents.restore({ ...base, documentId: parent.id });

    expect((await documentRow(parent.id))?.archivedAt).toBeNull();
    expect((await documentRow(sibling.id))?.archivedAt).toBeNull();
    expect(await documentRow(child.id)).toMatchObject({
      archivedRootId: child.id,
    });
  });

  it("refuses to restore a page that is not archived, one hidden by an ancestor, or one under an archived parent", async () => {
    const { client, base, addDocument } = await setup();
    const parent = await addDocument();
    const child = await addDocument({ parentId: parent.id });
    const grandchild = await addDocument({ parentId: child.id });
    const code = async (documentId: string) =>
      (await rejection(client.documents.restore({ ...base, documentId }))).data
        ?.code;

    expect(await code(parent.id)).toBe("DOCUMENT_NOT_ARCHIVED");

    await client.documents.archive({ ...base, documentId: grandchild.id });
    await client.documents.archive({ ...base, documentId: parent.id });
    // Archived on its own before its ancestor: it needs the ancestor back first.
    expect(await code(grandchild.id)).toBe("DOCUMENT_PARENT_ARCHIVED");
    // Hidden by the ancestor's archive: it comes back with the ancestor.
    expect(await code(child.id)).toBe("DOCUMENT_ARCHIVED_WITH_ANCESTOR");

    await client.documents.restore({ ...base, documentId: parent.id });
    await client.documents.restore({ ...base, documentId: grandchild.id });
    expect((await documentRow(grandchild.id))?.archivedAt).toBeNull();
  });

  it("refuses to archive twice and to restore into an archived project", async () => {
    const { client, workspace, base, addDocument } = await setup();
    const project = await createProject(client, workspace.id);
    const page = await addDocument({ projectId: project.id });
    await client.documents.archive({ ...base, documentId: page.id });

    expect(
      (
        await rejection(
          client.documents.archive({ ...base, documentId: page.id }),
        )
      ).data?.code,
    ).toBe("DOCUMENT_ARCHIVED");

    await client.projects.archive({
      workspaceId: workspace.id,
      projectId: project.id,
    });
    expect(
      (
        await rejection(
          client.documents.restore({ ...base, documentId: page.id }),
        )
      ).data?.code,
    ).toBe("PROJECT_ARCHIVED");
  });
});

describe("deleting a page", () => {
  it("moves the children up one level, keeping their order, between the page and its next sibling", async () => {
    const { client, base, addDocument } = await setup();
    const before = await addDocument({ position: positionAt(0) });
    const doomed = await addDocument({ position: positionAt(1) });
    const after = await addDocument({ position: positionAt(2) });
    const second = await addDocument({
      parentId: doomed.id,
      position: positionAt(5),
    });
    const first = await addDocument({
      parentId: doomed.id,
      position: positionAt(3),
    });
    const third = await addDocument({
      parentId: doomed.id,
      position: positionAt(7),
    });

    const deleted = await client.documents.delete({
      ...base,
      documentId: doomed.id,
    });

    expect(deleted.txid).toBeGreaterThan(0);
    expect(await documentRow(doomed.id)).toBeUndefined();
    const rows = await db
      .select({
        id: schema.documentTable.id,
        parentId: schema.documentTable.parentId,
        position: schema.documentTable.position,
      })
      .from(schema.documentTable)
      .where(eq(schema.documentTable.workspaceId, base.workspaceId))
      .orderBy(schema.documentTable.position);
    expect(rows.map((row) => row.id)).toEqual([
      before.id,
      first.id,
      second.id,
      third.id,
      after.id,
    ]);
    for (const child of [first, second, third]) {
      expect(rows.find((row) => row.id === child.id)?.parentId).toBeNull();
    }
  });

  it("puts the children under the deleted page's parent", async () => {
    const { client, base, addDocument } = await setup();
    const grandparent = await addDocument();
    const doomed = await addDocument({ parentId: grandparent.id });
    const child = await addDocument({ parentId: doomed.id });
    const grandchild = await addDocument({ parentId: child.id });

    await client.documents.delete({ ...base, documentId: doomed.id });

    expect((await documentRow(child.id))?.parentId).toBe(grandparent.id);
    expect((await documentRow(grandchild.id))?.parentId).toBe(child.id);
  });

  it("removes the page's stream, body and clients", async () => {
    const { client, base, addDocument } = await setup();
    const page = await addDocument();
    await db.insert(schema.documentBodyTable).values({
      documentId: page.id,
      content: { type: "doc" },
      stateVector: Buffer.from([0]),
      schemaVersion: 1,
    });
    expect(await streamExists(page.id)).toBe(true);

    await client.documents.delete({ ...base, documentId: page.id });

    expect(await streamExists(page.id)).toBe(false);
    expect(await db.select().from(schema.documentBodyTable)).toEqual([]);
    expect(await db.select().from(schema.documentClientTable)).toEqual([]);
  });

  it("lets pages an archived page hid be restored on their own after it is deleted", async () => {
    const { client, base, addDocument } = await setup();
    const doomed = await addDocument();
    const child = await addDocument({ parentId: doomed.id });
    const grandchild = await addDocument({ parentId: child.id });
    await client.documents.archive({ ...base, documentId: doomed.id });

    await client.documents.delete({ ...base, documentId: doomed.id });

    expect(await documentRow(child.id)).toMatchObject({
      parentId: null,
      archivedRootId: child.id,
    });
    expect((await documentRow(grandchild.id))?.archivedRootId).toBe(child.id);
    await client.documents.restore({ ...base, documentId: child.id });
    expect((await documentRow(grandchild.id))?.archivedAt).toBeNull();
  });
});

describe("rebuilding the streams", () => {
  it("recreates a lost stream from the stored content and leaves existing ones alone", async () => {
    const { addDocument } = await setup();
    const withBody = await addDocument();
    const empty = await addDocument();
    const kept = await addDocument();
    await db.insert(schema.documentBodyTable).values({
      documentId: withBody.id,
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Restored from Postgres" }],
          },
        ],
      },
      stateVector: Buffer.from([0]),
      schemaVersion: 1,
    });
    for (const id of [withBody.id, empty.id]) {
      await deletePageStream(streams.yjsUrl, { docId: id, generation: 1 });
    }

    const result = await rebuildDocumentStreams(streams.yjsUrl);

    expect(result).toEqual({ created: 2, skipped: 1 });
    expect(await streamExists(withBody.id)).toBe(true);
    expect(await streamExists(empty.id)).toBe(true);
    expect(await streamExists(kept.id)).toBe(true);
    const response = await fetch(
      `${streams.yjsUrl}/v1/yjs/morrow/docs/${withBody.id}/g1?offset=-1`,
    );
    const doc = new Y.Doc();
    const decoder = decoding.createDecoder(
      new Uint8Array(await response.arrayBuffer()),
    );
    while (decoding.hasContent(decoder)) {
      Y.applyUpdate(doc, decoding.readVarUint8Array(decoder));
    }
    expect(doc.getXmlFragment("default").toString()).toContain(
      "Restored from Postgres",
    );
    const clients = await db
      .select()
      .from(schema.documentClientTable)
      .where(eq(schema.documentClientTable.documentId, withBody.id));
    expect(clients).toHaveLength(2);
  });
});

describe("registering a client id", () => {
  it("is idempotent for the same user and refused for another", async () => {
    const { client, workspace, base, addDocument } = await setup();
    const other = await addWorkspaceMember(workspace.id, "member");
    const page = await addDocument();
    const register = (c: typeof client, clientId: number) =>
      c.documents.registerClient({ ...base, documentId: page.id, clientId });

    await register(client, 4_000_000_000);
    await register(client, 4_000_000_000);
    expect(
      (await rejection(register(as(other), 4_000_000_000))).data?.code,
    ).toBe("CLIENT_ID_TAKEN");
    await register(as(other), 12);
  });

  it("is refused for a Viewer, an archived page and a number that is not a client id", async () => {
    const { client, workspace, base, addDocument } = await setup();
    const viewer = as(await addWorkspaceMember(workspace.id, "viewer"));
    const page = await addDocument();
    const register = (c: typeof client, clientId: number) =>
      c.documents.registerClient({ ...base, documentId: page.id, clientId });

    expect((await rejection(register(viewer, 1))).code).toBe("FORBIDDEN");
    await expect(register(client, -1)).rejects.toBeDefined();
    await expect(register(client, 4_294_967_296)).rejects.toBeDefined();
    await client.documents.archive({ ...base, documentId: page.id });
    expect((await rejection(register(client, 1))).data?.code).toBe(
      "DOCUMENT_ARCHIVED",
    );
  });
});
