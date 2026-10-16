import { ORPCError } from "@orpc/server";
import { violatedConstraint } from "#api/projects/index";

/**
 * The refusals clients tell apart by `data.code`, with the status each one
 * carries. An invalid or taken position is the Projects vertical's
 * (`INVALID_POSITION`, `POSITION_TAKEN`).
 */
const CODES = {
  INVALID_ID: "BAD_REQUEST",
  ID_TAKEN: "CONFLICT",
  LABEL_NAME_TAKEN: "CONFLICT",
  POSITION_TAKEN: "CONFLICT",
  LABEL_LIMIT_REACHED: "CONFLICT",
} as const;

export type LabelErrorCode = keyof typeof CODES;

export function labelError(code: LabelErrorCode) {
  return new ORPCError(CODES[code], { data: { code } });
}

export const labelNotFound = () =>
  new ORPCError("NOT_FOUND", { message: "Label not found" });

/** Turns the unique-index violations a label write can hit into their typed refusals. */
export function rethrowLabelViolation(error: unknown): never {
  const violated = violatedConstraint(error);
  if (violated === "label_pkey") throw labelError("ID_TAKEN");
  if (violated === "label_workspace_name_uidx") {
    throw labelError("LABEL_NAME_TAKEN");
  }
  if (violated === "label_workspace_position_uidx") {
    throw labelError("POSITION_TAKEN");
  }
  throw error;
}
