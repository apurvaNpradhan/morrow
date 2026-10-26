/** The typed refusals of the page proxy (`YJS_REFUSALS` in the API), by `code`. */
const REFUSAL_CODES = [
  "FORBIDDEN",
  "DOCUMENT_ARCHIVED",
  "DOCUMENT_NOT_FOUND",
  "DOCUMENT_TOO_LARGE",
  "SCHEMA_MISMATCH",
  "INVALID_UPDATE",
  "RATE_LIMITED",
] as const;

export type PageRefusalCode = (typeof REFUSAL_CODES)[number];

/** Why the proxy turned a request down: its code when it gave one, and the HTTP status. */
export type PageRefusal = {
  code: PageRefusalCode | null;
  status: number | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function findCode(...sources: unknown[]): PageRefusalCode | null {
  for (const source of sources) {
    if (source === undefined) continue;
    const text = typeof source === "string" ? source : JSON.stringify(source);
    const code = REFUSAL_CODES.find((candidate) => text?.includes(candidate));
    if (code) return code;
  }
  return null;
}

/**
 * Reads a provider error. The provider throws the client library's errors,
 * which carry the status and the refusal's body, or a plain `Error` whose
 * message holds the status ("Failed to create document: 404 …"). Anything
 * without a status (a dropped connection) has none.
 */
export function refusalOf(error: unknown): PageRefusal {
  const e = asRecord(error);
  const fromMessage =
    typeof e.message === "string"
      ? Number(/:\s(\d{3})\b/.exec(e.message)?.[1])
      : Number.NaN;
  const status =
    typeof e.status === "number"
      ? e.status
      : Number.isNaN(fromMessage)
        ? null
        : fromMessage;
  return { code: findCode(e.json, e.details, e.text, e.message), status };
}

/**
 * Whether the editor keeps its edits and tries again: a dropped connection,
 * a 5xx, `RATE_LIMITED`, and any failure that carries no refusal code. The
 * last case includes the 400 the stream gives to the retry of a write the
 * rate limit turned down; the proxy's own refusals always carry a code.
 */
export function isRetryable({ code, status }: PageRefusal): boolean {
  return (
    code === null ||
    code === "RATE_LIMITED" ||
    status === null ||
    status === 429 ||
    status >= 500
  );
}
