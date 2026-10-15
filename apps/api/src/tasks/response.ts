import { TASK_PRIORITIES } from "@morrow/sync-schemas";
import { z } from "zod";

export const txid = z
  .number()
  .describe(
    "Postgres transaction id of the write, for waiting until sync delivers it.",
  );

export const txidResult = z.object({ txid });

export const createdResult = z.object({
  id: z.string(),
  number: z.number().describe("The Project's next ticket number."),
  txid,
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
  columnName: z.string(),
  category: z.string(),
  priority: z.enum(TASK_PRIORITIES),
  assigneeId: z.string().nullable(),
  assigneeName: z.string().nullable(),
  dueDate: z.string().nullable(),
  position: z.string(),
  completedAt: z.date().nullable(),
  archivedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const exportDocument = z.object({
  project: z.object({ key: z.string(), name: z.string() }),
  columns: z.array(z.object({ name: z.string(), category: z.string() })),
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
    }),
  ),
});
