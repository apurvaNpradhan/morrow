import { z } from "zod";
import { mcpTool } from "#api/platform/orpc/mcp-tool";

export const tasksMcpTools = [
  mcpTool({
    name: "list_tasks",
    description:
      "List the tasks of a project in board order, with ticket id, column, category, priority, assignee, due date and completion and archive state.",
    inputSchema: z.object({
      workspaceId: z.string().trim().min(1),
      projectId: z.string().trim().min(1),
    }),
    run: async (input, client) =>
      (await client.tasks.list(input)).map((task) => ({
        ticketId: task.ticketId,
        title: task.title,
        column: task.columnName,
        category: task.category,
        priority: task.priority,
        assignee: task.assigneeId
          ? { id: task.assigneeId, name: task.assigneeName }
          : null,
        dueDate: task.dueDate,
        completedAt: task.completedAt,
        archivedAt: task.archivedAt,
      })),
  }),
];
