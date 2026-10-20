import { ORPCError } from "@orpc/server";

/**
 * The refusals clients tell apart by `data.code`, with the status each one
 * carries.
 */
const CODES = {
  UPLOAD_TOO_LARGE: "BAD_REQUEST",
  UPLOAD_INVALID: "BAD_REQUEST",
  UPLOAD_MISSING: "BAD_REQUEST",
  ASSET_NOT_FOUND: "NOT_FOUND",
  STORAGE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
} as const;

export type StorageErrorCode = keyof typeof CODES;

export function storageError(code: StorageErrorCode) {
  return new ORPCError(CODES[code], { data: { code } });
}
