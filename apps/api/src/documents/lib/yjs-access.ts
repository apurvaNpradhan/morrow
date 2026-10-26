/** The page a request to the Yjs proxy is about: its Workspace, id and stream generation. */
export type YjsTarget = {
  workspaceId: string;
  docId: string;
  generation: number;
};

/** Why a request is refused, in the words of the typed refusals the editor understands. */
export type YjsRefusal = {
  status: 400 | 401 | 403 | 404 | 409 | 413 | 429 | 503;
  code: string;
  message: string;
};

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
export const refuseEveryPage: YjsAccessCheck = async () => ({
  status: 404,
  code: "DOCUMENT_NOT_FOUND",
  message: "There is no such page",
});

/** Until the pages' write check exists, every update that reaches it has passed. */
export const acceptEveryUpdate: YjsUpdateCheck = async () => null;
