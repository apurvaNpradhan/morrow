import {
  colorHex,
  fieldConfigSchema,
  namedFieldValueSchema,
  RELATION_DIRECTIONS,
  RELATION_TYPES,
  TASK_PRIORITIES,
} from "@morrow/sync-schemas";
import { z } from "zod";

export const txid = z
  .number()
  .describe(
    "Postgres transaction id of the write, for waiting until sync delivers it.",
  );

export const txidResult = z.object({ txid });

export const bulkResult = z.object({
  txid,
  skipped: z
    .number()
    .describe("How many ids were no longer Tasks of the Project."),
});

export const createdResult = z.object({
  id: z.string(),
  number: z.number().describe("The Project's next ticket number."),
  txid,
});

export const moveResult = z.object({
  moved: z.array(
    z.object({
      taskId: z.string(),
      fromTicketId: z.string(),
      toTicketId: z.string(),
      column: z.string().describe("The Column it landed in."),
      droppedValues: z.array(
        z.object({ field: z.string(), value: namedFieldValueSchema }),
      ),
      detachedFrom: z
        .string()
        .nullable()
        .describe("The Parent it left, by its old Ticket id."),
    }),
  ),
  txid,
});

export const ticketTask = z.object({
  id: z.string(),
  projectId: z.string(),
  ticketId: z
    .string()
    .describe(
      "Its current Ticket id, which may differ from the one asked for.",
    ),
});

export const archivedColumnResult = z.object({
  count: z.number().describe("How many tasks were archived."),
  txid: txid.nullable(),
});

const importWarning = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("column_unmatched"),
    column: z.string(),
    usedColumn: z.string(),
    count: z.number(),
  }),
  z.object({
    kind: z.literal("assignee_unknown"),
    email: z.string(),
    count: z.number(),
  }),
  z.object({ kind: z.literal("assignee_dropped"), count: z.number() }),
  z.object({
    kind: z.literal("label_dropped"),
    label: z.string(),
    count: z.number(),
  }),
  z.object({
    kind: z.literal("field_dropped"),
    field: z.string(),
    count: z.number(),
  }),
  z.object({
    kind: z.literal("option_dropped"),
    field: z.string(),
    option: z.string(),
    count: z.number(),
  }),
  z.object({
    kind: z.literal("value_dropped"),
    field: z.string(),
    count: z.number(),
  }),
  z.object({
    kind: z.literal("comment_author_unknown"),
    email: z.string(),
    count: z.number(),
  }),
]);

export type ImportWarning = z.infer<typeof importWarning>;

export const importResult = z.object({
  created: z.number(),
  warnings: z.array(importWarning),
  txid,
});

export const taskListItem = z.object({
  id: z.string(),
  projectId: z.string(),
  ticketId: z.string(),
  number: z.number(),
  title: z.string(),
  description: z.string(),
  columnId: z.string(),
  parentId: z.string().nullable(),
  subtaskDone: z.number(),
  subtaskTotal: z.number(),
  openBlockerCount: z.number(),
  columnName: z.string(),
  category: z.string(),
  priority: z.enum(TASK_PRIORITIES),
  assigneeId: z.string().nullable(),
  assigneeName: z.string().nullable(),
  dueDate: z.string().nullable(),
  labelIds: z.array(z.string()),
  commentCount: z.number(),
  position: z.string(),
  completedAt: z.date().nullable(),
  archivedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

const namedFields = z
  .record(z.string(), namedFieldValueSchema)
  .describe(
    "Value by Field name: option name(s) for a choice, a string, number or YYYY-MM-DD date, true for a checked checkbox; Fields without a value are absent.",
  );

export const taskSearchResult = z.object({
  truncated: z.boolean().describe("More tasks matched than were returned."),
  tasks: z.array(
    z.object({
      ticketId: z.string(),
      parentTicketId: z.string().nullable(),
      subtaskDone: z.number(),
      subtaskTotal: z.number(),
      openBlockerCount: z.number(),
      projectKey: z.string(),
      title: z.string(),
      description: z.string(),
      columnName: z.string(),
      category: z.string(),
      priority: z.enum(TASK_PRIORITIES),
      assigneeId: z.string().nullable(),
      assigneeName: z.string().nullable(),
      dueDate: z.string().nullable(),
      labels: z.array(z.string()),
      fields: namedFields,
      completedAt: z.date().nullable(),
      archivedAt: z.date().nullable(),
    }),
  ),
});

export const exportDocument = z.object({
  project: z.object({ key: z.string(), name: z.string() }),
  labels: z.array(z.object({ name: z.string(), color: colorHex })),
  columns: z.array(z.object({ name: z.string(), category: z.string() })),
  fields: z.array(
    z.object({
      name: z.string(),
      type: z.string(),
      config: fieldConfigSchema,
      options: z.array(z.object({ name: z.string(), color: colorHex })),
    }),
  ),
  tasks: z.array(
    z.object({
      number: z.number(),
      title: z.string(),
      description: z.string(),
      column: z.string(),
      category: z.string(),
      priority: z.enum(TASK_PRIORITIES),
      dueDate: z.string().nullable(),
      assigneeEmail: z.string().nullable(),
      completedAt: z.string().nullable(),
      archivedAt: z.string().nullable(),
      createdAt: z.string(),
      labels: z.array(z.string()),
      fields: namedFields,
      comments: z.array(
        z.object({
          authorEmail: z.string().nullable(),
          body: z.string(),
          createdAt: z.string(),
          editedAt: z.string().nullable(),
        }),
      ),
    }),
  ),
});

/** One task with its labels and comments, for readers outside the web app (MCP). */
export const taskDetail = z.object({
  id: z.string(),
  projectId: z
    .string()
    .describe("Its Project, which is not the one asked for after a move."),
  ticketId: z.string(),
  parent: z.object({ ticketId: z.string(), title: z.string() }).nullable(),
  subtaskDone: z.number(),
  subtaskTotal: z.number(),
  openBlockerCount: z.number(),
  title: z.string(),
  description: z.string(),
  column: z.string(),
  category: z.string(),
  priority: z.enum(TASK_PRIORITIES),
  assignee: z.object({ id: z.string(), name: z.string() }).nullable(),
  dueDate: z.string().nullable(),
  completedAt: z.date().nullable(),
  archivedAt: z.date().nullable(),
  createdAt: z.date(),
  fields: namedFields,
  labels: z.array(z.object({ name: z.string(), color: colorHex })),
  links: z.array(
    z.object({ id: z.string(), url: z.string(), title: z.string().nullable() }),
  ),
  relations: z.array(
    z.object({
      id: z.string(),
      type: z.enum(RELATION_TYPES),
      direction: z
        .enum(RELATION_DIRECTIONS)
        .describe("outgoing: this task blocks / is the duplicate."),
      kind: z.enum([
        "blocks",
        "blocked_by",
        "related",
        "duplicate_of",
        "duplicated_by",
      ]),
      ticketId: z.string().describe("The other task's."),
      title: z.string().describe("The other task's."),
    }),
  ),
  comments: z.array(
    z.object({
      id: z.string(),
      author: z.object({ id: z.string(), name: z.string() }).nullable(),
      body: z.string(),
      createdAt: z.date(),
      editedAt: z.date().nullable(),
    }),
  ),
});
