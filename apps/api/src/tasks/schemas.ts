import {
  COMMENT_BODY_MAX,
  fieldValuesSchema,
  MAX_BULK_TASKS,
  MAX_MOVE_TASKS,
  isTaskDateText,
  isHttpUrl,
  LINK_TITLE_MAX,
  LINK_URL_MAX,
  TASK_DESCRIPTION_MAX,
  TASK_PRIORITIES,
  TASK_TITLE_MAX,
} from "@morrow/sync-schemas";
import { z } from "zod";

/** The fields clients send. Every limit lives here, once. */

export const workspaceId = z.string().min(1);
export const projectId = z.string().min(1);
export const columnId = z.string().min(1);
export const taskId = z.string().min(1);

/** A client-chosen id; its format is checked by the operation (INVALID_ID). */
export const newTaskId = z.string().min(1).max(64);

export const title = z.string().trim().min(1).max(TASK_TITLE_MAX);
export const description = z.string().max(TASK_DESCRIPTION_MAX);
export const priority = z.enum(TASK_PRIORITIES);
export const assigneeId = z.string().min(1);
export const labelId = z.string().min(1);
export const fieldId = z.string().min(1);
/** A custom Field value of any type; `null` clears it. The operation checks it against the Field. */
export const fieldValue = z.json();
/** Values for a new Task, by Field id; the operation checks every one. */
export const fieldValues = fieldValuesSchema;
export const commentId = z.string().min(1);

/** A client-chosen id; its format is checked by the operation (INVALID_COMMENT_ID). */
export const newCommentId = z.string().min(1).max(64);

export const commentBody = z.string().trim().min(1).max(COMMENT_BODY_MAX);

export const linkId = z.string().min(1);

/** A client-chosen id; its format is checked by the operation (INVALID_LINK_ID). */
export const newLinkId = z.string().min(1).max(64);

/** An http(s) address; `javascript:`, `data:` and other schemes are refused. */
export const linkUrl = z
  .string()
  .trim()
  .max(LINK_URL_MAX)
  .refine(isHttpUrl, "Must be an http or https address");

/** Optional; empty means none. */
export const linkTitle = z
  .string()
  .trim()
  .max(LINK_TITLE_MAX)
  .transform((value) => (value === "" ? null : value));

/** A day, `YYYY-MM-DD`, or a moment, ISO 8601 with an offset. */
export const dueDate = z
  .string()
  .refine(
    isTaskDateText,
    "Must be a day (YYYY-MM-DD) or a moment with an offset (2026-10-24T15:00+05:30)",
  );

/** A fractional-index key; its format is checked by the operation. */
export const position = z.string().min(1).max(64);

/** The Tasks of one bulk action, in view order; repeats are dropped by the operation. */
export const bulkTaskIds = z.array(taskId).min(1).max(MAX_BULK_TASKS);

/** The Tasks of one move; the operation counts their Subtasks and refuses past `MAX_MOVE_TASKS`. */
export const moveTaskIds = z
  .array(taskId)
  .min(1)
  .max(MAX_MOVE_TASKS * 10);

/** What a bulk action does to every Task it names. */
export const bulkChange = z.discriminatedUnion("type", [
  z.object({ type: z.literal("move"), columnId }),
  z.object({ type: z.literal("priority"), priority }),
  z.object({ type: z.literal("assignee"), assigneeId: assigneeId.nullable() }),
  z.object({ type: z.literal("dueDate"), dueDate: dueDate.nullable() }),
  z.object({ type: z.literal("addLabel"), labelId }),
  z.object({ type: z.literal("removeLabel"), labelId }),
  z.object({ type: z.literal("archive"), archived: z.boolean() }),
]);
