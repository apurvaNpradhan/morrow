import { z } from "zod";
import { mcpTool } from "#api/platform/orpc/mcp-tool";
import { resolveColumn } from "../mcp-resolve";
import { columnCategory, columnColor, columnName } from "../schemas";
import { ORPCError } from "@orpc/server";

export const columnsMcpTools = [
  mcpTool({
    name: "manage_column",
    description:
      "Create, update or delete a project column. create takes name, category and optional color as #rrggbb hex. update takes column (its name) with a new name and/or color (#rrggbb). delete takes column and moveTasksTo, the column that receives its tasks.",
    inputSchema: z.object({
      workspaceId: z.string().trim().min(1),
      projectId: z.string().trim().min(1),
      action: z.enum(["create", "update", "delete"]),
      column: z.string().optional(),
      name: columnName.optional(),
      category: columnCategory.optional(),
      color: columnColor.optional(),
      moveTasksTo: z.string().optional(),
    }),
    run: async (input, client) => {
      const { workspaceId, projectId, action } = input;
      const scope = { workspaceId, projectId };
      if (action === "create") {
        if (!input.name || !input.category) {
          throw missing("name and category");
        }
        const { id } = await client.projects.columns.create({
          ...scope,
          name: input.name,
          category: input.category,
          color: input.color,
        });
        return { columnId: id };
      }
      if (!input.column) throw missing("column");
      const { column } = await resolveColumn(client, scope, input.column);
      if (action === "update") {
        await client.projects.columns.update({
          ...scope,
          columnId: column.id,
          name: input.name,
          color: input.color,
        });
        return { columnId: column.id, updated: true };
      }
      if (!input.moveTasksTo) throw missing("moveTasksTo");
      const target = await resolveColumn(client, scope, input.moveTasksTo);
      await client.projects.columns.remove({
        ...scope,
        columnId: column.id,
        targetColumnId: target.column.id,
      });
      return { columnId: column.id, deleted: true };
    },
  }),
];

function missing(fields: string) {
  return new ORPCError("BAD_REQUEST", { message: `${fields} required` });
}
