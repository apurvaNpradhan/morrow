/** The page a request to the Yjs proxy is about: its Workspace, id and stream generation. */
export type YjsTarget = {
  workspaceId: string;
  docId: string;
  generation: number;
};

/**
 * The typed refusals of the page proxy, with the status each carries. The
 * editor tells them apart by `code`: a network error, a 5xx and `RATE_LIMITED`
 * are retried and keep the edits; every other one is terminal.
 */
export const YJS_REFUSALS = {
  FORBIDDEN: 403,
  DOCUMENT_ARCHIVED: 409,
  DOCUMENT_NOT_FOUND: 404,
  DOCUMENT_TOO_LARGE: 413,
  SCHEMA_MISMATCH: 409,
  INVALID_UPDATE: 400,
  RATE_LIMITED: 429,
} as const;

export type YjsRefusalCode = keyof typeof YJS_REFUSALS;

/** Why a request is refused. */
export type YjsRefusal = {
  status: (typeof YJS_REFUSALS)[YjsRefusalCode] | 503;
  code: string;
  message: string;
  /** Seconds until a `RATE_LIMITED` writer may try again. */
  retryAfterSeconds?: number;
};

export function refusal(
  code: YjsRefusalCode,
  message: string,
  extra: { retryAfterSeconds?: number } = {},
): YjsRefusal {
  return { status: YJS_REFUSALS[code], code, message, ...extra };
}

export type YjsRequest = {
  userId: string;
  target: YjsTarget;
  /** `write` for a POST of updates or awareness, `read` for everything else. */
  mode: "read" | "write";
};

/**
 * Whether the user may read or write the page. Run on every request, so a
 * removed member stops receiving within one long-poll.
 */
export type YjsAccessCheck = (
  request: YjsRequest,
) => Promise<YjsRefusal | null>;

/** What one decoded update, or awareness update, is checked as before it is forwarded. */
export type YjsUpdate = YjsRequest & {
  kind: "document" | "awareness";
  update: Uint8Array;
};

/**
 * The single place each decoded update passes before it reaches the stream.
 * Returns a refusal to stop the whole request.
 */
export type YjsUpdateCheck = (update: YjsUpdate) => Promise<YjsRefusal | null>;

/** Until there are pages, no page can be reached. */
export const refuseEveryPage: YjsAccessCheck = async () =>
  refusal("DOCUMENT_NOT_FOUND", "There is no such page");
