import { HttpError } from "./http-error";
import { errorCode } from "./orpc-error";

export function isForbiddenOrNotFound(error: unknown): boolean {
  const code = errorCode(error);
  if (code === "FORBIDDEN" || code === "NOT_FOUND") return true;
  return (
    error instanceof HttpError && (error.status === 403 || error.status === 404)
  );
}
