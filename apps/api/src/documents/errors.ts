import { ORPCError } from "@orpc/server";
import { violatedConstraint } from "#api/projects/index";

/**
 * The refusals clients tell apart by `data.code`, with the status each one
 * carries. An invalid position is the Projects vertical's (`INVALID_POSITION`),
 * an archived Project its `PROJECT_ARCHIVED`.
 */
const CODES = {
  INVALID_DOCUMENT_ID: "BAD_REQUEST",
  DOCUMENT_ID_TAKEN: "CONFLICT",
  DOCUMENT_ARCHIVED: "CONFLICT",
  DOCUMENT_NOT_ARCHIVED: "CONFLICT",
  DOCUMENT_ARCHIVED_WITH_ANCESTOR: "CONFLICT",
  DOCUMENT_PARENT_ARCHIVED: "CONFLICT",
  DOCUMENT_CYCLE: "BAD_REQUEST",
  PARENT_NOT_IN_PROJECT: "BAD_REQUEST",
  CLIENT_ID_TAKEN: "CONFLICT",
} as const;

export type DocumentErrorCode = keyof typeof CODES;

export function documentError(code: DocumentErrorCode) {
  return new ORPCError(CODES[code], { data: { code } });
}

export const documentNotFound = () =>
  new ORPCError("NOT_FOUND", { message: "Page not found" });

/** Turns the unique-index violations a page write can hit into their typed refusals. */
export function rethrowDocumentViolation(error: unknown): never {
  if (violatedConstraint(error) === "documents_pkey") {
    throw documentError("DOCUMENT_ID_TAKEN");
  }
  throw error;
}
