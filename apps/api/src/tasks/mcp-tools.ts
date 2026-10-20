import { createId } from "@paralleldrive/cuid2";
import { generateKeyBetween } from "fractional-indexing";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import { absoluteAssetUrls } from "@morrow/sync-schemas";
import { config } from "#api/platform/config";
import { mcpTool } from "#api/platform/orpc/mcp-tool";
import { resolveColumn } from "#api/projects/index";
import { description, dueDate, priority, title } from "./schemas";
import {
  resolveAssigneeId,
  resolveLabelIds,
  resolveFieldValues,
  resolveOrCreateLabelIds,
  resolveTask,
  taskPositions,
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

const parentTicket = z
  .string()
  .trim()
  .min(1)
  .describe("The parent's ticket id, for example MOR-12; same project.");

const fieldsByName = z
  .record(z.string(), z.string())
  .describe('Option name by Field name, for example { "Size": "Large" }.');

const createItem = z.object({
  title,
  description: description.optional(),
  column: z.string().optional(),
  priority: priority.optional(),
  assignee: z.string().optional(),
  dueDate: dueDate.optional(),
  labels: z.array(z.string()).optional(),
  fields: fieldsByName.optional(),
  parentId: parentTicket.optional(),
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
  fields: z
    .record(z.string(), z.string().nullable())
    .optional()
    .describe(
      'Option name by Field name, for example { "Size": "Large" }; null clears that Field.',
    ),
  column: z
    .string()
    .optional()
    .describe(
      "Moves the task to this column; moving to a done column completes it.",
    ),
  at: edge
    .optional()
    .describe("With column: top or bottom of it (default bottom)."),
  parentId: parentTicket
    .nullable()
    .optional()
    .describe("A ticket id sets the parent; null makes the task top-level."),
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

/** Files attached to markdown are fetched with the agent's own token, so their links must be absolute. */
const absoluteLinks = (markdown: string) =>
  absoluteAssetUrls(markdown, config.apiUrl);

export const tasksMcpTools = [
  mcpTool({
    name: "list_tasks",
    readOnly: true,
    description:
      'List tasks in board order. Without projectId it lists every project of the workspace (each task then carries its project key). Filter by assignee ("me" or an email), label name, column name (needs projectId), priority, state (open or closed), text in title or description, and archived state. Each task carries its custom Field values by name when it has any. Descriptions are left out unless withDescription is true. At most limit tasks (default 50, max 200); truncated says when more matched, so narrow the query or raise limit.',
    inputSchema: z.object({
      workspaceId: z.string().trim().min(1),
      projectId: z.string().trim().min(1).optional(),
      assignee: z.string().trim().min(1).optional(),
      label: z.string().trim().min(1).optional(),
      column: z.string().trim().min(1).optional(),
      priority: priority.optional(),
      state: z
        .enum(["open", "closed"])
        .optional()
        .describe("closed: in a done or canceled column; open: anywhere else."),
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
          parent: task.parentTicketId,
          subtasks: { done: task.subtaskDone, total: task.subtaskTotal },
          openBlockers: task.openBlockerCount,
          labels: task.labels,
          ...(Object.keys(task.fields).length > 0 && { fields: task.fields }),
          completedAt: task.completedAt,
          archivedAt: task.archivedAt,
          ...(withDescription && {
            description: absoluteLinks(task.description),
          }),
        })),
      };
    },
  }),
  mcpTool({
    name: "get_task",
    readOnly: true,
    description:
      "Get one task by ticket id (for example MOR-12): its parent (ticket id and title), subtask counts (done of total, archived left out, canceled counted as done), description, labels (names and colours), custom Field values (option name by Field name), external links (id, url, title), relations (id, type, direction, kind: blocks, blocked_by, related, duplicate_of or duplicated_by, and the other task's ticket id and title) and comments, oldest first, with the fields list_tasks gives.",
    inputSchema: z.object({
      workspaceId: z.string().trim().min(1),
      projectId: z.string().trim().min(1),
      ticketId: z.string().trim().min(1),
    }),
    run: async (input, client) => {
      const task = await client.tasks.get(input);
      return {
        ...task,
        description: absoluteLinks(task.description),
        comments: task.comments.map((comment) => ({
          ...comment,
          body: absoluteLinks(comment.body),
        })),
      };
    },
  }),
  mcpTool({
    name: "create_tasks",
    description:
      "Create 1–50 tasks in one call. Each item has a title and optionally parentId (a ticket id of this project), description, column (named; default the project's first), priority, assignee (a member's email), dueDate, labels (named; missing ones are created), fields (option name by Field name) and at (top or bottom). Items run in order; an item that fails to resolve (unknown column, assignee) does not stop the rest, but a malformed item (bad date, empty title) rejects the whole call before anything is created. Returns a small result per item, each with its index.",
    inputSchema: project.extend({
      items: z.array(createItem).min(1).max(MAX_BATCH),
    }),
    run: async (input, client) => {
      const positionIn = taskPositions(client, input);
      return runBatch(input.items, async (item) => {
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
        const fieldValues = item.fields
          ? Object.fromEntries(
              (await resolveFieldValues(client, input, item.fields)).map(
                ({ fieldId, value }) => [fieldId, value as string],
              ),
            )
          : undefined;
        const created = await client.tasks.create({
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          id: createId(),
          columnId: column.id,
          position: await positionIn(column.id, item.at),
          fieldValues,
          title: item.title,
          description: item.description,
          priority: item.priority,
          dueDate: item.dueDate,
          assigneeId: item.assignee
            ? await resolveAssigneeId(client, input.workspaceId, item.assignee)
            : undefined,
          labelIds: labels?.ids,
          parentId: item.parentId
            ? (await resolveTask(client, input, item.parentId)).taskId
            : undefined,
        });
        return {
          ticketId: `${projectKey}-${created.number}`,
          ...(labels?.created.length && { createdLabels: labels.created }),
        };
      });
    },
  }),
  mcpTool({
    name: "update_tasks",
    description:
      "Change 1–50 tasks in one call, each named by ticketId. Only the fields an item passes change; null clears dueDate, assignee (an email) and parentId (a ticket id; refused if it would make a loop). addLabels creates missing labels; removeLabels names existing ones. fields sets custom Fields by name (option name by Field name; null clears one). column moves the task, at its top or bottom (default bottom). Items run in order; an item that fails to resolve (unknown task, label, assignee) changes nothing and does not stop the rest, but a malformed item (bad date) rejects the whole call before anything changes. An item with no field besides ticketId is an error. Returns the changed field names per item, each with its index.",
    inputSchema: project.extend({
      items: z.array(updateItem).min(1).max(MAX_BATCH),
    }),
    run: async (input, client) => {
      const positionIn = taskPositions(client, input);
      return runBatch(input.items, async (item) => {
        const { ticketId, at: _at, ...fields } = item;
        if (
          Object.values(fields).every(
            (value) =>
              value === undefined ||
              (Array.isArray(value) && value.length === 0) ||
              (typeof value === "object" &&
                value !== null &&
                !Array.isArray(value) &&
                Object.keys(value).length === 0),
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
        const parentId =
          item.parentId == null
            ? item.parentId
            : (await resolveTask(client, input, item.parentId)).taskId;
        const fieldWrites = item.fields
          ? await resolveFieldValues(client, input, item.fields)
          : [];
        const target = item.column
          ? (await resolveColumn(client, input, item.column)).column
          : undefined;
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
        if (parentId !== undefined) {
          await client.tasks.updateParent({ ...scope, parentId });
          changed.push("parentId");
        }
        if (fieldWrites.length) {
          for (const { fieldId, value } of fieldWrites)
            await client.tasks.setFieldValue({ ...scope, fieldId, value });
          changed.push("fields");
        }
        if (target) {
          await client.tasks.move({
            ...scope,
            columnId: target.id,
            position: await positionIn(target.id, item.at ?? "bottom"),
          });
          changed.push("column");
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
      });
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
        position: await taskPositions(
          client,
          input,
          scope.taskId,
        )(column.id, input.at),
      });
      return { ticketId: input.ticketId, column: column.name };
    },
  }),
  mcpTool({
    name: "duplicate_task",
    description:
      'Copy a task into the same column, right after the original, as a new ticket titled "<title> (copy)". The copy keeps the description, priority, due date, labels, custom Field values and, if you may assign, the assignee. Comments, links and relations are not copied; completion is reset unless the column is a done column.',
    inputSchema: task,
    run: async (input, client) => {
      const scope = await resolveTask(client, input, input.ticketId);
      const tasks = await client.tasks.list(input);
      const source = tasks.find((t) => t.id === scope.taskId);
      if (!source) {
        throw new ORPCError("NOT_FOUND", {
          message: `No task ${input.ticketId}`,
        });
      }
      const next = tasks
        .filter(
          (t) => t.columnId === source.columnId && t.position > source.position,
        )
        .map((t) => t.position)
        .sort()[0];
      const created = await client.tasks.duplicate({
        ...scope,
        id: createId(),
        position: generateKeyBetween(source.position, next ?? null),
      });
      const { projectKey } = await resolveColumn(client, input);
      return {
        ticketId: `${projectKey}-${created.number}`,
        from: input.ticketId,
      };
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
