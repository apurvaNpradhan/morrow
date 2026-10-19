import { z } from "zod";
import { mcpTool } from "#api/platform/orpc/mcp-tool";

export const fieldsMcpTools = [
  mcpTool({
    name: "list_fields",
    readOnly: true,
    description:
      "List a project's custom Fields in order, each with its type and options (name, colour). Set a Field's value on a task by name through create_tasks or update_tasks.",
    inputSchema: z.object({
      workspaceId: z.string().trim().min(1),
      projectId: z.string().trim().min(1),
    }),
    run: async (input, client) =>
      (await client.projects.fields.list(input)).map(
        ({ name, type, options }) => ({
          name,
          type,
          options: options.map(({ name, color }) => ({ name, color })),
        }),
      ),
  }),
];
