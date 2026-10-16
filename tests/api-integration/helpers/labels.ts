import { randomBytes } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "../../../apps/api/src/platform/database";
import { positionAt } from "./tasks";

/** A well-formed cuid2, as the browser would generate. */
export function newLabelId() {
  return `l${randomBytes(12).toString("hex").slice(0, 23)}`;
}

/** A workspace's labels straight from the database, in position order. */
export async function labelRows(workspaceId: string) {
  const rows = await db
    .select()
    .from(schema.labelTable)
    .where(eq(schema.labelTable.workspaceId, workspaceId))
    .orderBy(asc(schema.labelTable.position));
  return rows;
}

/** Adds labels through the API, one position after the other. */
export function labelFactory<
  Client extends {
    labels: {
      create: (input: {
        workspaceId: string;
        id: string;
        name: string;
        color: "red";
        position: string;
      }) => Promise<{ id: string; txid: number }>;
    };
  },
>(client: Client, workspaceId: string) {
  let next = 0;
  return async function addLabel(name: string) {
    const id = newLabelId();
    const created = await client.labels.create({
      workspaceId,
      id,
      name,
      color: "red",
      position: positionAt(next++),
    });
    return { ...created, id };
  };
}
