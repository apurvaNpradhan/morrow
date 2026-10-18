import { createId } from "@paralleldrive/cuid2";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { mcpTool } from "#api/platform/orpc/mcp-tool";
import { resolveColumn } from "#api/projects/index";
import { description, dueDate, priority, title } from "./schemas";
import {
  resolveAssigneeId,
  resolveLabelIds,
  resolveOrCreateLabelIds,
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

const MAX_BATCH = 50;

const createItem = z.object({
  title,
  description: description.optional(),
  column: z.string().optional(),
  priority: priority.optional(),
  assignee: z.string().optional(),
  dueDate: dueDate.optional(),
  labels: z.array(z.string()).optional(),
  at: edge.default("bottom"),
});

const updateItem = z.object({
  ticketId: z.string().trim().min(1).describe("For example MOR-12."),
  title: title.optional(),
  description: description.optional(),
  priority: priority.optional(),
  dueDate: dueDate.nullable().optional(),
  assignee: z.string().nullable().optional(),
  addLabels: z.array(z.string()).optional(),
  removeLabels: z.array(z.string()).optional(),
});

/**
 * Runs the items one at a time, in order. Every result carries its `index`; a
 * failure becomes that item's `{ index, error }` and the rest still run, so
 * one bad item hides nothing.
 */
async function runBatch<Item, Result extends object>(
  items: Item[],
  run: (item: Item) => Promise<Result>,
) {
  const results: Array<
    ({ index: number } & Result) | { index: number; error: string }
  > = [];
  for (const [index, item] of items.entries()) {
    try {
      results.push({ index, ...(await run(item)) });
    } catch (error) {
      results.push({
        index,
        error: error instanceof Error ? error.message : "Failed",
      });
    }
  }
  return results;
}

export const tasksMcpTools = [
  mcpTool({
    name: "list_tasks",
    description:
      'List tasks in board order. Without projectId it lists every project of the workspace (each task then carries its project key). Filter by assignee ("me" or an email), label name, column name (needs projectId), text in title or description, and archived state. Descriptions are left out unless withDescription is true. At most limit tasks (default 50, max 200); truncated says when more matched, so narrow the query or raise limit.',
    inputSchema: z.object({
      workspaceId: z.string().trim().min(1),
      projectId: z.string().trim().min(1).optional(),
      assignee: z.string().trim().min(1).optional(),
      label: z.string().trim().min(1).optional(),
      column: z.string().trim().min(1).optional(),
      query: z.string().trim().min(1).max(200).optional(),
      includeArchived: z.boolean().default(false),
      withDescription: z.boolean().default(false),
      limit: z.number().int().min(1).max(200).default(50),
    }),
    run: async ({ withDescription, ...input }, client) => {
      if (input.column && !input.projectId) {
        throw new ORPCError("BAD_REQUEST", {
          message: "column needs projectId; columns belong to a project.",
        });
      }
      const { tasks, truncated } = await client.tasks.search(input);
      return {
        truncated,
        tasks: tasks.map((task) => ({
          ticketId: task.ticketId,
          ...(input.projectId ? {} : { project: task.projectKey }),
          title: task.title,
          column: task.columnName,
          category: task.category,
          priority: task.priority,
          assignee: task.assigneeId
            ? { id: task.assigneeId, name: task.assigneeName }
            : null,
          dueDate: task.dueDate,
          labels: task.labels,
          completedAt: task.completedAt,
          archivedAt: task.archivedAt,
          ...(withDescription && { description: task.description }),
        })),
      };
    },
  }),
  mcpTool({
    name: "get_task",
    description:
      "Get one task by ticket id (for example MOR-12): its description, labels (names and colours), external links (id, url, title) and comments, oldest first, with the fields list_tasks gives.",
    inputSchema: z.object({
      workspaceId: z.string().trim().min(1),
      projectId: z.string().trim().min(1),
      ticketId: z.string().trim().min(1),
    }),
    run: (input, client) => client.tasks.get(input),
  }),
  mcpTool({
    name: "create_tasks",
    description:
      "Create 1–50 tasks in one call. Each item has a title and optionally description, column (named; default the project's first), priority, assignee (a member's email), dueDate, labels (named; missing ones are created) and at (top or bottom). Items run in order; an item that fails to resolve (unknown column, assignee) does not stop the rest, but a malformed item (bad date, empty title) rejects the whole call before anything is created. Returns a small result per item, each with its index.",
    inputSchema: project.extend({
      items: z.array(createItem).min(1).max(MAX_BATCH),
    }),
    run: async (input, client) =>
      runBatch(input.items, async (item) => {
        const { column, projectKey } = await resolveColumn(
          client,
          input,
          item.column,
        );
        const labels = item.labels
          ? await resolveOrCreateLabelIds(
              client,
              input.workspaceId,
              item.labels,
            )
          : undefined;
        const created = await client.tasks.create({
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          id: createId(),
          columnId: column.id,
          position: await taskPosition(client, input, column.id, item.at),
          title: item.title,
          description: item.description,
          priority: item.priority,
          dueDate: item.dueDate,
          assigneeId: item.assignee
            ? await resolveAssigneeId(client, input.workspaceId, item.assignee)
            : undefined,
          labelIds: labels?.ids,
        });
        return {
          ticketId: `${projectKey}-${created.number}`,
          ...(labels?.created.length && { createdLabels: labels.created }),
        };
      }),
  }),
  mcpTool({
    name: "update_tasks",
    description:
      "Change 1–50 tasks in one call, each named by ticketId. Only the fields an item passes change; null clears dueDate and assignee (an email). addLabels creates missing labels; removeLabels names existing ones. Items run in order; an item that fails to resolve (unknown task, label, assignee) changes nothing and does not stop the rest, but a malformed item (bad date) rejects the whole call before anything changes. An item with no field besides ticketId is an error. Returns the changed field names per item, each with its index.",
    inputSchema: project.extend({
      items: z.array(updateItem).min(1).max(MAX_BATCH),
    }),
    run: async (input, client) =>
      runBatch(input.items, async (item) => {
        const { ticketId, ...fields } = item;
        if (
          Object.values(fields).every(
            (value) =>
              value === undefined ||
              (Array.isArray(value) && value.length === 0),
          )
        ) {
          throw new ORPCError("BAD_REQUEST", {
            message: "Nothing to change; pass a field besides ticketId.",
          });
        }
        const scope = await resolveTask(client, input, ticketId);
        // Resolve every name before the first write, so a bad one changes nothing.
        const assigneeId =
          item.assignee == null
            ? item.assignee
            : await resolveAssigneeId(client, input.workspaceId, item.assignee);
        const removeIds = item.removeLabels?.length
          ? await resolveLabelIds(client, input.workspaceId, item.removeLabels)
          : [];
        const added = item.addLabels?.length
          ? await resolveOrCreateLabelIds(
              client,
              input.workspaceId,
              item.addLabels,
            )
          : undefined;

        const changed: string[] = [];
        if (item.title !== undefined) {
          await client.tasks.updateTitle({ ...scope, title: item.title });
          changed.push("title");
        }
        if (item.description !== undefined) {
          await client.tasks.updateDescription({
            ...scope,
            description: item.description,
          });
          changed.push("description");
        }
        if (item.priority !== undefined) {
          await client.tasks.updatePriority({
            ...scope,
            priority: item.priority,
          });
          changed.push("priority");
        }
        if (item.dueDate !== undefined) {
          await client.tasks.updateDueDate({ ...scope, dueDate: item.dueDate });
          changed.push("dueDate");
        }
        if (assigneeId !== undefined) {
          await client.tasks.updateAssignee({ ...scope, assigneeId });
          changed.push("assignee");
        }
        if (added) {
          for (const labelId of added.ids)
            await client.tasks.addLabel({ ...scope, labelId });
          changed.push("addLabels");
        }
        if (removeIds.length) {
          for (const labelId of removeIds)
            await client.tasks.removeLabel({ ...scope, labelId });
          changed.push("removeLabels");
        }
        return {
          ticketId,
          changed,
          ...(added?.created.length && { createdLabels: added.created }),
        };
      }),
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
