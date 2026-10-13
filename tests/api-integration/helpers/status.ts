import type { ORPCError } from "@orpc/client";

const STATUS_BY_CODE: Record<string, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
};

/** The HTTP status a procedure call amounts to: 200 on success, else its error code's status. */
export async function statusOf(call: Promise<unknown>): Promise<number> {
  try {
    await call;
    return 200;
  } catch (error) {
    const code = (error as ORPCError<string, unknown>).code;
    return STATUS_BY_CODE[code] ?? 500;
  }
}
