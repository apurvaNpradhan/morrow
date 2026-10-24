import {
  COLUMN_CATEGORIES,
  COMMENT_BODY_MAX,
  isTaskDateText,
  namedFieldValueSchema,
  TASK_DESCRIPTION_MAX,
  TASK_PRIORITIES,
  TASK_TITLE_MAX,
} from "@morrow/sync-schemas";
import { z } from "zod";
import { startsAfterDue } from "./task-date-columns";

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
  labels: z
    .array(z.object({ name: z.string(), color: z.string().optional() }))
    .default([]),
  fields: z
    .array(
      z.object({
        name: z.string(),
        type: z.string().optional(),
        config: z.unknown().optional(),
        options: z
          .array(z.object({ name: z.string(), color: z.string().optional() }))
          .default([]),
      }),
    )
    .default([]),
  tasks: z.array(
    z
      .object({
        number: z.number().int().default(0),
        title: z.string().trim().min(1).max(TASK_TITLE_MAX),
        description: z.string().max(TASK_DESCRIPTION_MAX).default(""),
        column: z.string().default(""),
        category: z.enum(COLUMN_CATEGORIES).optional(),
        priority: z.enum(TASK_PRIORITIES).default("none"),
        startDate: z.string().refine(isTaskDateText).nullable().default(null),
        dueDate: z.string().refine(isTaskDateText).nullable().default(null),
        assigneeEmail: z.string().nullable().default(null),
        completedAt: isoDate.nullable().default(null),
        archivedAt: isoDate.nullable().default(null),
        createdAt: isoDate.nullable().default(null),
        labels: z.array(z.string()).default([]),
        fields: z.record(z.string(), namedFieldValueSchema).default({}),
        comments: z
          .array(
            z.object({
              authorEmail: z.string().nullable().default(null),
              body: z.string().max(COMMENT_BODY_MAX),
              createdAt: isoDate.nullable().default(null),
              editedAt: isoDate.nullable().default(null),
            }),
          )
          .default([]),
      })
      .refine((task) => !startsAfterDue(task.startDate, task.dueDate), {
        message: "A start date is after the due date",
        path: ["startDate"],
      }),
  ),
});
