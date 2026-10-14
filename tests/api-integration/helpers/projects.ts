import { createORPCClient, type ORPCError } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "../../../apps/api/src/platform/database";
import { createApp } from "../../../apps/api/src/index";
import type { AppRouter } from "../../../apps/api/src/platform/orpc/router";
import { mockAuthenticatedSession } from "./auth";
import { createWorkspaceMember } from "./fixtures";

const { app } = createApp();

type User = Parameters<typeof mockAuthenticatedSession>[0];

/**
 * A client acting as this user. The session lookup is faked (per request, so
 * clients of different users can be used in turn); everything else is real.
 */
export function as(user: User): RouterClient<AppRouter> {
  const link = new RPCLink({
    origin: "http://localhost",
    url: "/rpc",
    fetch: (input, init) => {
      mockAuthenticatedSession(user);
      return app.fetch(new Request(input, init));
    },
  });
  return createORPCClient(link);
}

/** The refusal a call ends in; fails the test if the call succeeds. */
export async function rejection(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error as ORPCError<string, { code?: string }>;
  }
  throw new Error("Expected the call to be rejected");
}

/** A workspace with an owner, and a client acting as them. */
export async function setupWorkspace() {
  const { user: owner, workspace } = await createWorkspaceMember({
    role: "owner",
  });
  return { owner, workspace, client: as(owner) };
}

/** A project in the workspace, created through the API. */
export async function createProject(
  client: RouterClient<AppRouter>,
  workspaceId: string,
  key = "MOR",
) {
  return client.projects.create({ workspaceId, name: `Project ${key}`, key });
}

/** A project's columns straight from the database, in board order. */
export async function columnsOf(projectId: string) {
  const rows = await db
    .select()
    .from(schema.projectColumnTable)
    .where(eq(schema.projectColumnTable.projectId, projectId))
    .orderBy(asc(schema.projectColumnTable.position));
  const order = ["backlog", "unstarted", "started", "done", "canceled"];
  return rows.sort(
    (a, b) =>
      order.indexOf(a.category) - order.indexOf(b.category) ||
      (a.position < b.position ? -1 : a.position > b.position ? 1 : 0),
  );
}

export async function projectRow(projectId: string) {
  const [row] = await db
    .select()
    .from(schema.projectTable)
    .where(eq(schema.projectTable.id, projectId));
  return row;
}
