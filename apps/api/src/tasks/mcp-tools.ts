import { createId } from "@paralleldrive/cuid2";
import { z } from "zod";
import { mcpTool } from "#api/platform/orpc/mcp-tool";
import { resolveColumn } from "#api/projects/index";
import { description, dueDate, priority, title } from "./schemas";
import {
  resolveAssigneeId,
  resolveLabelIds,
  resolveTask,
  taskPosition,
} from "./mcp-resolve";

const project = z.object({
  workspaceId: z.string().trim().min(1),
  projectId: z.string().trim().min(1),
});
const task = project.extend({
  ticketId: z.string().trim().min(1).describe("For example MOR-12."),
});
const edge = z.enum(["top", "bottom"]);

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
  mcpTool({
    name: "get_task",
    description:
      "Get one task by ticket id (for example MOR-12): its description, labels (names and colours) and comments, oldest first, with the fields list_tasks gives.",
    inputSchema: z.object({
      workspaceId: z.string().trim().min(1),
      projectId: z.string().trim().min(1),
      ticketId: z.string().trim().min(1),
    }),
    run: (input, client) => client.tasks.get(input),
  }),
  mcpTool({
    name: "create_task",
    description:
      "Create a task. The column is named (default: the project's first), the assignee is a member's email, labels are named.",
    inputSchema: project.extend({
      title,
      description: description.optional(),
      column: z.string().optional(),
      priority: priority.optional(),
      assignee: z.string().optional(),
      dueDate: dueDate.optional(),
      labels: z.array(z.string()).optional(),
      at: edge.default("bottom"),
    }),
    run: async (input, client) => {
      const { column, projectKey } = await resolveColumn(
        client,
        input,
        input.column,
      );
      const created = await client.tasks.create({
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        id: createId(),
        columnId: column.id,
        position: await taskPosition(client, input, column.id, input.at),
        title: input.title,
        description: input.description,
        priority: input.priority,
        dueDate: input.dueDate,
        assigneeId: input.assignee
          ? await resolveAssigneeId(client, input.workspaceId, input.assignee)
          : undefined,
        labelIds: input.labels
          ? await resolveLabelIds(client, input.workspaceId, input.labels)
          : undefined,
      });
      return { ticketId: `${projectKey}-${created.number}` };
    },
  }),
  mcpTool({
    name: "update_task",
    description:
      "Change a task. Only the fields you pass change; null clears dueDate and assignee (an email). Labels are named.",
    inputSchema: task.extend({
      title: title.optional(),
      description: description.optional(),
      priority: priority.optional(),
      dueDate: dueDate.nullable().optional(),
      assignee: z.string().nullable().optional(),
      addLabels: z.array(z.string()).optional(),
      removeLabels: z.array(z.string()).optional(),
    }),
    run: async (input, client) => {
      const scope = await resolveTask(client, input, input.ticketId);
      if (input.title !== undefined)
        await client.tasks.updateTitle({ ...scope, title: input.title });
      if (input.description !== undefined)
        await client.tasks.updateDescription({
          ...scope,
          description: input.description,
        });
      if (input.priority !== undefined)
        await client.tasks.updatePriority({
          ...scope,
          priority: input.priority,
        });
      if (input.dueDate !== undefined)
        await client.tasks.updateDueDate({ ...scope, dueDate: input.dueDate });
      if (input.assignee !== undefined)
        await client.tasks.updateAssignee({
          ...scope,
          assigneeId:
            input.assignee === null
              ? null
              : await resolveAssigneeId(
                  client,
                  input.workspaceId,
                  input.assignee,
                ),
        });
      for (const labelId of await resolveLabelIds(
        client,
        input.workspaceId,
        input.addLabels ?? [],
      ))
        await client.tasks.addLabel({ ...scope, labelId });
      for (const labelId of await resolveLabelIds(
        client,
        input.workspaceId,
        input.removeLabels ?? [],
      ))
        await client.tasks.removeLabel({ ...scope, labelId });
      return { ticketId: input.ticketId, updated: true };
    },
  }),
  mcpTool({
    name: "move_task",
    description:
      "Move a task to a named column, at its top or bottom (default bottom). Moving to a done column completes it.",
    inputSchema: task.extend({
      column: z.string(),
      at: edge.default("bottom"),
    }),
    run: async (input, client) => {
      const scope = await resolveTask(client, input, input.ticketId);
      const { column } = await resolveColumn(client, input, input.column);
      await client.tasks.move({
        ...scope,
        columnId: column.id,
        position: await taskPosition(
          client,
          input,
          column.id,
          input.at,
          scope.taskId,
        ),
      });
      return { ticketId: input.ticketId, column: column.name };
    },
  }),
  mcpTool({
    name: "archive_task",
    description: "Archive a task, or restore it with archived: false.",
    inputSchema: task.extend({ archived: z.boolean().default(true) }),
    run: async ({ archived, ...input }, client) => {
      const scope = await resolveTask(client, input, input.ticketId);
      await (archived
        ? client.tasks.archive(scope)
        : client.tasks.unarchive(scope));
      return { ticketId: input.ticketId, archived };
    },
  }),
  mcpTool({
    name: "delete_task",
    description: "Permanently delete a task. Archive it instead to keep it.",
    inputSchema: task,
    run: async (input, client) => {
      await client.tasks.remove(
        await resolveTask(client, input, input.ticketId),
      );
      return { ticketId: input.ticketId, deleted: true };
    },
  }),
];
