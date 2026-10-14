import { ORPCError } from "@orpc/server";

/**
 * The refusals clients tell apart by `data.code`, with the status each one
 * carries. Anything not listed here is a plain NOT_FOUND / FORBIDDEN.
 */
const CODES = {
  PROJECT_KEY_TAKEN: "CONFLICT",
  POSITION_TAKEN: "CONFLICT",
  PROJECT_ARCHIVED: "CONFLICT",
  PROJECT_NOT_ARCHIVED: "CONFLICT",
  COLUMN_NAME_TAKEN: "CONFLICT",
  LAST_REQUIRED_COLUMN: "CONFLICT",
  INVALID_POSITION: "BAD_REQUEST",
  INVALID_TARGET_COLUMN: "BAD_REQUEST",
} as const;

export type ProjectErrorCode = keyof typeof CODES;

export function projectError(code: ProjectErrorCode) {
  return new ORPCError(CODES[code], { data: { code } });
}

export const projectNotFound = () =>
  new ORPCError("NOT_FOUND", { message: "Project not found" });

export const columnNotFound = () =>
  new ORPCError("NOT_FOUND", { message: "Column not found" });

const UNIQUE_VIOLATION = "23505";

/** The name of the unique index a failed write violated, if that is what failed. */
export function violatedConstraint(error: unknown): string | null {
  for (let cause = error; cause; cause = (cause as { cause?: unknown }).cause) {
    const { code, constraint } = cause as {
      code?: unknown;
      constraint?: unknown;
    };
    if (code === UNIQUE_VIOLATION) {
      return typeof constraint === "string" ? constraint : "";
    }
  }
  return null;
}
