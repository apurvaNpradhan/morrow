import {
  isCalendarDate,
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

/** A calendar day, `YYYY-MM-DD`. */
export const dueDate = z
  .string()
  .refine(isCalendarDate, "Must be a calendar date (YYYY-MM-DD)");

/** A fractional-index key; its format is checked by the operation. */
export const position = z.string().min(1).max(64);
