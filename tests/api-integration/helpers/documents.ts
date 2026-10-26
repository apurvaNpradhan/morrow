import { randomBytes } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "../../../apps/api/src/platform/database";
import { positionAt } from "./tasks";

/** A well-formed cuid2, as the browser would generate. */
export function newDocumentId() {
  return `d${randomBytes(12).toString("hex").slice(0, 23)}`;
}

/** A Workspace's pages straight from the database, in position order. */
export async function documentRows(workspaceId: string) {
  return db
    .select()
    .from(schema.documentTable)
    .where(eq(schema.documentTable.workspaceId, workspaceId))
    .orderBy(asc(schema.documentTable.position), asc(schema.documentTable.id));
}

export async function documentRow(id: string) {
  const [row] = await db
    .select()
    .from(schema.documentTable)
    .where(eq(schema.documentTable.id, id));
  return row;
}

type Client = {
  documents: {
    create: (input: {
      workspaceId: string;
      id: string;
      projectId: string | null;
      parentId: string | null;
      position: string;
      title?: string;
    }) => Promise<{ id: string; txid: number }>;
  };
};

/** Adds pages through the API, one position after the other. */
export function documentFactory(client: Client, workspaceId: string) {
  let next = 0;
  return async function addDocument(
    input: {
      title?: string;
      projectId?: string | null;
      parentId?: string | null;
      position?: string;
    } = {},
  ) {
    const id = newDocumentId();
    const created = await client.documents.create({
      workspaceId,
      id,
      projectId: input.projectId ?? null,
      parentId: input.parentId ?? null,
      position: input.position ?? positionAt(next++),
      title: input.title ?? "Page",
    });
    return { ...created, id };
  };
}
