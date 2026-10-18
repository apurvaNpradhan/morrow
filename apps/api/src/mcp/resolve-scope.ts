import { ORPCError } from "@orpc/server";
import type { McpClient } from "#api/platform/orpc/mcp-tool";

const TICKET_ID = /^([A-Za-z0-9]{2,6})-\d+$/;

const refused = (message: string) => new ORPCError("BAD_REQUEST", { message });

/**
 * Lets callers name a workspace by slug and leave out projectId when they give
 * a ticket id (its key prefix names the project). Returns the args with real
 * ids, ready for the tool's own schema.
 */
export async function resolveScope(
  client: McpClient,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const { workspaceId, projectId, ticketId } = args;
  if (typeof workspaceId !== "string") return args;

  const workspaces = await client.workspace.list();
  const workspace = workspaces.find(
    (w) => w.id === workspaceId || w.slug === workspaceId,
  );
  if (!workspace) {
    const slugs = workspaces.map((w) => w.slug).join(", ");
    throw refused(`No workspace "${workspaceId}". Workspaces: ${slugs}`);
  }
  const resolved = { ...args, workspaceId: workspace.id };
  if (projectId !== undefined || typeof ticketId !== "string") return resolved;

  const key = TICKET_ID.exec(ticketId.trim())?.[1]?.toUpperCase();
  if (!key) throw refused(`"${ticketId}" is not a ticket id like MOR-12`);
  const projects = await client.projects.list({ workspaceId: workspace.id });
  const project = projects.find((p) => p.key.toUpperCase() === key);
  if (!project) {
    const keys = projects.map((p) => p.key).join(", ");
    throw new ORPCError("NOT_FOUND", {
      message: `No project with key ${key} in ${workspace.slug}. Keys: ${keys}`,
    });
  }
  return { ...resolved, projectId: project.id };
}
