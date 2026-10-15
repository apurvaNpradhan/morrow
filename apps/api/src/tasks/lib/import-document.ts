import {
  COLUMN_CATEGORIES,
  isCalendarDate,
  TASK_DESCRIPTION_MAX,
  TASK_PRIORITIES,
  TASK_TITLE_MAX,
} from "@morrow/sync-schemas";
import { z } from "zod";

export const MAX_IMPORT_TASKS = 5000;
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
/** The request around the document: the JSON envelope and the ids. */
export const MAX_IMPORT_REQUEST_BYTES = MAX_IMPORT_BYTES + 16 * 1024;

const isoDate = z.iso.datetime({ offset: true }).transform((v) => new Date(v));

/** The document `exportTasks` writes. Unknown fields are ignored. */
export const importDocument = z.object({
  columns: z
    .array(z.object({ name: z.string(), category: z.enum(COLUMN_CATEGORIES) }))
    .default([]),
  tasks: z.array(
    z.object({
      number: z.number().int().default(0),
      title: z.string().trim().min(1).max(TASK_TITLE_MAX),
      description: z.string().max(TASK_DESCRIPTION_MAX).default(""),
      column: z.string().default(""),
      category: z.enum(COLUMN_CATEGORIES).optional(),
      priority: z.enum(TASK_PRIORITIES).default("none"),
      dueDate: z.string().refine(isCalendarDate).nullable().default(null),
      assigneeEmail: z.string().nullable().default(null),
      completedAt: isoDate.nullable().default(null),
      archivedAt: isoDate.nullable().default(null),
      createdAt: isoDate.nullable().default(null),
    }),
  ),
});
