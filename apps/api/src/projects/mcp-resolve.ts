import { ORPCError } from "@orpc/server";
import type { McpClient } from "#api/platform/orpc/mcp-tool";

/** The named column, or the project's first column when no name is given. */
export async function resolveColumn(
  client: McpClient,
  scope: { workspaceId: string; projectId: string },
  name?: string,
) {
  const projects = await client.projects.list({
    workspaceId: scope.workspaceId,
  });
  const project = projects.find(({ id }) => id === scope.projectId);
  if (!project)
    throw new ORPCError("NOT_FOUND", { message: "Project not found" });
  const column = name
    ? project.columns.find(
        (c) => c.name.trim().toLowerCase() === name.trim().toLowerCase(),
      )
    : project.columns[0];
  if (!column) {
    const names = project.columns.map((c) => c.name).join(", ");
    throw new ORPCError("BAD_REQUEST", {
      message: `No column named "${name}". Columns: ${names}`,
    });
  }
  return { column, projectKey: project.key };
}
