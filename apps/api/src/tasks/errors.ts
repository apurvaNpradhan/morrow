import { ORPCError } from "@orpc/server";
import { projectError, violatedConstraint } from "#api/projects/index";

/**
 * The refusals clients tell apart by `data.code`, with the status each one
 * carries. Position and archived-project refusals are the Projects vertical's
 * (`POSITION_TAKEN`, `INVALID_POSITION`, `PROJECT_ARCHIVED`).
 */
const CODES = {
  INVALID_ID: "BAD_REQUEST",
  ID_TAKEN: "CONFLICT",
  COLUMN_NOT_IN_PROJECT: "BAD_REQUEST",
  COLUMN_NOT_CLOSED: "BAD_REQUEST",
  ASSIGNEE_NOT_MEMBER: "BAD_REQUEST",
  FORBIDDEN_ASSIGN: "FORBIDDEN",
  IMPORT_TOO_LARGE: "BAD_REQUEST",
  IMPORT_INVALID: "BAD_REQUEST",
  INVALID_COMMENT_ID: "BAD_REQUEST",
  COMMENT_ID_TAKEN: "CONFLICT",
  COMMENT_NOT_YOURS: "FORBIDDEN",
} as const;

export type TaskErrorCode = keyof typeof CODES;

export function taskError(code: TaskErrorCode) {
  return new ORPCError(CODES[code], { data: { code } });
}

export const taskNotFound = () =>
  new ORPCError("NOT_FOUND", { message: "Task not found" });

export const commentNotFound = () =>
  new ORPCError("NOT_FOUND", { message: "Comment not found" });

/** Turns the unique-index violations a task write can hit into their typed refusals. */
export function rethrowTaskViolation(error: unknown): never {
  const violated = violatedConstraint(error);
  if (violated === "task_pkey") throw taskError("ID_TAKEN");
  if (violated === "task_comment_pkey") throw taskError("COMMENT_ID_TAKEN");
  if (violated === "task_column_position_uidx") {
    throw projectError("POSITION_TAKEN");
  }
  throw error;
}
