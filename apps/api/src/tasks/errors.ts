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
  INVALID_FIELD_VALUE: "BAD_REQUEST",
  IMPORT_TOO_LARGE: "BAD_REQUEST",
  IMPORT_INVALID: "BAD_REQUEST",
  INVALID_COMMENT_ID: "BAD_REQUEST",
  COMMENT_ID_TAKEN: "CONFLICT",
  COMMENT_NOT_YOURS: "FORBIDDEN",
  INVALID_LINK_ID: "BAD_REQUEST",
  LINK_ID_TAKEN: "CONFLICT",
  LINK_URL_TAKEN: "CONFLICT",
  TOO_MANY_LINKS: "CONFLICT",
  PARENT_NOT_IN_PROJECT: "BAD_REQUEST",
  PARENT_CYCLE: "BAD_REQUEST",
  INVALID_RELATION_ID: "BAD_REQUEST",
  RELATION_ID_TAKEN: "CONFLICT",
  RELATION_EXISTS: "CONFLICT",
  RELATION_SELF: "BAD_REQUEST",
  RELATION_TASK_NOT_IN_WORKSPACE: "BAD_REQUEST",
  RELATION_CYCLE: "BAD_REQUEST",
  MOVE_TOO_LARGE: "BAD_REQUEST",
  MOVE_SAME_PROJECT: "BAD_REQUEST",
  START_AFTER_DUE: "BAD_REQUEST",
  INVALID_RECURRENCE: "BAD_REQUEST",
  RECURRENCE_NEEDS_DUE_DATE: "BAD_REQUEST",
  SUBTASK_CANNOT_REPEAT: "BAD_REQUEST",
} as const;

export type TaskErrorCode = keyof typeof CODES;

export function taskError(
  code: TaskErrorCode,
  extra: Record<string, unknown> = {},
) {
  return new ORPCError(CODES[code], { data: { code, ...extra } });
}

export const taskNotFound = () =>
  new ORPCError("NOT_FOUND", { message: "Task not found" });

export const commentNotFound = () =>
  new ORPCError("NOT_FOUND", { message: "Comment not found" });

export const linkNotFound = () =>
  new ORPCError("NOT_FOUND", { message: "Link not found" });

export const relationNotFound = () =>
  new ORPCError("NOT_FOUND", { message: "Relation not found" });

/** Turns the unique-index violations a task write can hit into their typed refusals. */
export function rethrowTaskViolation(error: unknown): never {
  const violated = violatedConstraint(error);
  if (violated === "task_pkey") throw taskError("ID_TAKEN");
  if (violated === "task_comment_pkey") throw taskError("COMMENT_ID_TAKEN");
  if (violated === "task_link_pkey") throw taskError("LINK_ID_TAKEN");
  if (violated === "task_link_task_url_uidx") {
    throw taskError("LINK_URL_TAKEN");
  }
  if (violated === "task_relation_pkey") throw taskError("RELATION_ID_TAKEN");
  if (violated === "task_relation_type_source_target_uidx") {
    throw taskError("RELATION_EXISTS");
  }
  if (violated === "task_column_position_uidx") {
    throw projectError("POSITION_TAKEN");
  }
  throw error;
}
