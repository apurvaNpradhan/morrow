import * as decoding from "lib0/decoding";
import * as encoding from "lib0/encoding";
import { eq } from "drizzle-orm";
import * as Y from "yjs";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vite-plus/test";
import { createApp } from "../../apps/api/src/index";
import { db, schema } from "../../apps/api/src/platform/database";
import { mockAuthenticatedSession } from "./helpers/auth";
import { addWorkspaceMember } from "./helpers/add-workspace-member";
import { resetTestDatabase } from "./helpers/database";
import { documentFactory } from "./helpers/documents";
import { startPageStreams } from "./helpers/page-streams";
import { as, createProject, setupWorkspace } from "./helpers/projects";

const { app } = createApp();
const FRAGMENT = "default";

let streams: Awaited<ReturnType<typeof startPageStreams>>;
beforeAll(async () => {
  streams = await startPageStreams();
});
afterAll(() => streams.stop());
beforeEach(resetTestDatabase);

type User = Awaited<ReturnType<typeof addWorkspaceMember>>;

function frame(...updates: Uint8Array[]) {
  const encoder = encoding.createEncoder();
  for (const update of updates) encoding.writeVarUint8Array(encoder, update);
  return encoding.toUint8Array(encoder);
}

function proxy(
  user: User,
  workspaceId: string,
  docId: string,
  {
    generation = 1,
    query = "",
    method = "GET",
    body,
  }: {
    generation?: number;
    query?: string;
    method?: string;
    body?: Uint8Array;
  } = {},
) {
  mockAuthenticatedSession(user);
  return app.request(
    `/api/documents/yjs/${workspaceId}/docs/${docId}/g${generation}${query}`,
    {
      method,
      headers: { "content-type": "application/octet-stream" },
      body: body as BodyInit | undefined,
    },
  );
}

async function refusalOf(response: Response) {
  expect(response.ok).toBe(false);
  const { code } = (await response.json()) as { code: string };
  return { status: response.status, code };
}

/** The page as a client has it after a sync: the stream read through the proxy. */
async function loadPage(user: User, workspaceId: string, docId: string) {
  const response = await proxy(user, workspaceId, docId, {
    query: "?offset=-1",
  });
  expect(response.status).toBe(200);
  const doc = new Y.Doc();
  const decoder = decoding.createDecoder(
    new Uint8Array(await response.arrayBuffer()),
  );
  while (decoding.hasContent(decoder)) {
    Y.applyUpdate(doc, decoding.readVarUint8Array(decoder));
  }
  return doc;
}

/** The update a local change to the page makes. */
function change(doc: Y.Doc, edit: (fragment: Y.XmlFragment) => void) {
  const updates: Uint8Array[] = [];
  doc.on("update", (update: Uint8Array) => updates.push(update));
  doc.transact(() => edit(doc.getXmlFragment(FRAGMENT)));
  return updates[0]!;
}

const typeText = (value: string) => (fragment: Y.XmlFragment) => {
  const paragraph = fragment.get(0) as Y.XmlElement;
  paragraph.insert(0, [new Y.XmlText(value)]);
};

async function setup() {
  const context = await setupWorkspace();
  const member = await addWorkspaceMember(context.workspace.id, "member");
  const viewer = await addWorkspaceMember(context.workspace.id, "viewer");
  const outsider = (await setupWorkspace()).owner;
  const addDocument = documentFactory(context.client, context.workspace.id);
  const memberClient = as(member);
  const page = await addDocument();
  const registered = async (
    user: User,
    client: ReturnType<typeof as>,
    docId: string,
  ) => {
    const doc = await loadPage(user, context.workspace.id, docId);
    await client.documents.registerClient({
      workspaceId: context.workspace.id,
      documentId: docId,
      clientId: doc.clientID,
    });
    return doc;
  };
  return {
    ...context,
    member,
    viewer,
    outsider,
    memberClient,
    addDocument,
    page,
    registered,
    workspaceId: context.workspace.id,
  };
}

describe("the page write check", () => {
  it("lets a member write and the update reaches the stream", async () => {
    const { member, memberClient, workspaceId, page, registered } =
      await setup();
    const doc = await registered(member, memberClient, page.id);

    const response = await proxy(member, workspaceId, page.id, {
      method: "POST",
      body: frame(change(doc, typeText("hello"))),
    });

    expect(response.status).toBe(204);
    const reread = await loadPage(member, workspaceId, page.id);
    expect(reread.getXmlFragment(FRAGMENT).toString()).toContain("hello");
  });

  it("refuses a Viewer's write, a non-member and another Workspace's page", async () => {
    const {
      viewer,
      outsider,
      member,
      workspaceId,
      page,
      memberClient,
      registered,
    } = await setup();
    const doc = await registered(member, memberClient, page.id);
    const body = frame(change(doc, typeText("x")));

    const asViewer = await proxy(viewer, workspaceId, page.id, {
      method: "POST",
      body,
    });
    expect(await refusalOf(asViewer)).toEqual({
      status: 403,
      code: "FORBIDDEN",
    });
    expect(
      (await proxy(viewer, workspaceId, page.id, { query: "?offset=-1" }))
        .status,
    ).toBe(200);

    const stranger = await proxy(outsider, workspaceId, page.id, {
      query: "?offset=-1",
    });
    expect(await refusalOf(stranger)).toEqual({
      status: 404,
      code: "DOCUMENT_NOT_FOUND",
    });

    const elsewhere = await proxy(outsider, "someotherworkspace", page.id, {
      method: "POST",
      body,
    });
    expect(elsewhere.status).toBe(404);
  });

  it("refuses a write to an archived page, one under an archived ancestor and one in an archived project", async () => {
    const {
      client,
      member,
      workspaceId,
      workspace,
      addDocument,
      memberClient,
      registered,
    } = await setup();
    const project = await createProject(client, workspace.id);
    const archived = await addDocument();
    const parent = await addDocument();
    const child = await addDocument({ parentId: parent.id });
    const inProject = await addDocument({ projectId: project.id });
    const docs = new Map<string, Y.Doc>();
    for (const page of [archived, child, inProject]) {
      docs.set(page.id, await registered(member, memberClient, page.id));
    }
    await client.documents.archive({ workspaceId, documentId: archived.id });
    await client.documents.archive({ workspaceId, documentId: parent.id });
    await client.projects.archive({ workspaceId, projectId: project.id });

    for (const page of [archived, child, inProject]) {
      const response = await proxy(member, workspaceId, page.id, {
        method: "POST",
        body: frame(change(docs.get(page.id)!, typeText("x"))),
      });
      expect(await refusalOf(response)).toEqual({
        status: 409,
        code: "DOCUMENT_ARCHIVED",
      });
      expect(
        (await proxy(member, workspaceId, page.id, { query: "?offset=-1" }))
          .status,
      ).toBe(200);
    }
  });

  it("answers a wrong generation with SCHEMA_MISMATCH", async () => {
    const { member, workspaceId, page } = await setup();

    const response = await proxy(member, workspaceId, page.id, {
      generation: 2,
      query: "?offset=-1",
    });

    expect(await refusalOf(response)).toEqual({
      status: 409,
      code: "SCHEMA_MISMATCH",
    });
  });

  it("refuses an update over 1 MB and a body over the limit", async () => {
    const { member, memberClient, workspaceId, page, registered } =
      await setup();
    const doc = await registered(member, memberClient, page.id);
    const big = change(doc, typeText("x".repeat(1024 * 1024 + 10)));
    expect(big.byteLength).toBeGreaterThan(1024 * 1024);
    expect(big.byteLength).toBeLessThan(1024 * 1024 + 16 * 1024);

    const tooLarge = await proxy(member, workspaceId, page.id, {
      method: "POST",
      body: frame(big),
    });
    expect(await refusalOf(tooLarge)).toEqual({
      status: 413,
      code: "DOCUMENT_TOO_LARGE",
    });

    const huge = await proxy(member, workspaceId, page.id, {
      method: "POST",
      body: new Uint8Array(1024 * 1024 + 20 * 1024),
    });
    expect(huge.status).toBe(413);
  });

  it("refuses an unknown node, a script link and a foreign image as invalid", async () => {
    const { member, memberClient, workspaceId, page, registered } =
      await setup();
    const doc = await registered(member, memberClient, page.id);
    const send = (edit: (fragment: Y.XmlFragment) => void) =>
      proxy(member, workspaceId, page.id, {
        method: "POST",
        body: frame(change(doc, edit)),
      });

    const unknown = await send((fragment) =>
      fragment.insert(1, [new Y.XmlElement("iframe")]),
    );
    const link = await send((fragment) => {
      const run = new Y.XmlText();
      (fragment.get(0) as Y.XmlElement).insert(0, [run]);
      run.insert(0, "click", { link: { href: "javascript:alert(1)" } });
    });
    const image = await send((fragment) => {
      const node = new Y.XmlElement("assetImage");
      node.setAttribute("src", "https://evil.example.com/p.png");
      node.setAttribute("alt", "");
      (fragment.get(0) as Y.XmlElement).insert(0, [node]);
    });

    for (const response of [unknown, link, image]) {
      expect(await refusalOf(response)).toEqual({
        status: 400,
        code: "INVALID_UPDATE",
      });
    }
  });

  it("refuses an update written under a client id that is someone else's or nobody's", async () => {
    const {
      member,
      owner,
      client,
      memberClient,
      workspaceId,
      page,
      registered,
    } = await setup();
    const mine = await registered(member, memberClient, page.id);
    const ownersDoc = await loadPage(owner, workspaceId, page.id);
    await client.documents.registerClient({
      workspaceId,
      documentId: page.id,
      clientId: ownersDoc.clientID,
    });

    const stolen = new Y.Doc();
    Y.applyUpdate(stolen, Y.encodeStateAsUpdate(mine));
    stolen.clientID = ownersDoc.clientID;
    const unregistered = new Y.Doc();
    Y.applyUpdate(unregistered, Y.encodeStateAsUpdate(mine));
    unregistered.clientID = 123456;

    for (const doc of [stolen, unregistered]) {
      const response = await proxy(member, workspaceId, page.id, {
        method: "POST",
        body: frame(change(doc, typeText("forged"))),
      });
      expect(await refusalOf(response)).toEqual({
        status: 403,
        code: "FORBIDDEN",
      });
    }
  });

  it("refuses an insert while the page is over its limit and lets a delete through", async () => {
    const { member, memberClient, workspaceId, page, registered } =
      await setup();
    const doc = await registered(member, memberClient, page.id);
    const typing = change(doc, typeText("hello world"));
    await proxy(member, workspaceId, page.id, {
      method: "POST",
      body: frame(typing),
    });
    await db
      .update(schema.documentTable)
      .set({ overLimit: true })
      .where(eq(schema.documentTable.id, page.id));

    const insert = await proxy(member, workspaceId, page.id, {
      method: "POST",
      body: frame(
        change(doc, (fragment) => {
          const run = (fragment.get(0) as Y.XmlElement).get(0) as Y.XmlText;
          run.insert(0, "more");
        }),
      ),
    });
    expect(await refusalOf(insert)).toEqual({
      status: 413,
      code: "DOCUMENT_TOO_LARGE",
    });

    const remove = await proxy(member, workspaceId, page.id, {
      method: "POST",
      body: frame(
        change(doc, (fragment) => {
          const run = (fragment.get(0) as Y.XmlElement).get(0) as Y.XmlText;
          run.delete(0, 5);
        }),
      ),
    });
    expect(remove.status).toBe(204);
  });

  it("stops serving a member who has been removed", async () => {
    const { member, workspaceId, page } = await setup();
    expect(
      (await proxy(member, workspaceId, page.id, { query: "?offset=-1" }))
        .status,
    ).toBe(200);

    await db
      .delete(schema.workspaceUserTable)
      .where(eq(schema.workspaceUserTable.userId, member.id));

    const response = await proxy(member, workspaceId, page.id, {
      query: "?offset=-1",
    });
    expect(await refusalOf(response)).toEqual({
      status: 404,
      code: "DOCUMENT_NOT_FOUND",
    });
  });

  it("does not touch the synced row while people type", async () => {
    const { member, memberClient, workspaceId, page, registered } =
      await setup();
    const doc = await registered(member, memberClient, page.id);
    const before = await db.execute(
      `SELECT xmin::text AS xmin, updated_at FROM documents WHERE id = '${page.id}'` as never,
    );

    for (const word of ["one", "two", "three"]) {
      await proxy(member, workspaceId, page.id, {
        method: "POST",
        body: frame(
          change(doc, (fragment) => {
            const paragraph = fragment.get(0) as Y.XmlElement;
            paragraph.insert(paragraph.length, [new Y.XmlText(word)]);
          }),
        ),
      });
    }
    await new Promise((resolve) => setTimeout(resolve, 1_500));

    const after = await db.execute(
      `SELECT xmin::text AS xmin, updated_at FROM documents WHERE id = '${page.id}'` as never,
    );
    expect(after.rows).toEqual(before.rows);
  });
});
