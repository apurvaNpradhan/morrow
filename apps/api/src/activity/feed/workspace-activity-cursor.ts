/** A precise timestamp and activity ID used to continue the workspace feed. */
export type WorkspaceActivityCursor = {
  createdAt: Date;
  id: string;
};

/** Encodes the stable timestamp-and-ID position for the next activity page. */
export function encodeWorkspaceActivityCursor(
  cursor: WorkspaceActivityCursor,
): string {
  return Buffer.from(
    `${cursor.createdAt.toISOString()}\n${cursor.id}`,
  ).toString("base64url");
}

/** Parses a bounded opaque activity cursor; malformed positions return null. */
export function parseWorkspaceActivityCursor(
  input: string,
): WorkspaceActivityCursor | null {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(input)) return null;
  const decoded = Buffer.from(input, "base64url").toString();
  if (Buffer.from(decoded).toString("base64url") !== input) return null;
  const [timestamp, id, extra] = decoded.split("\n");
  const createdAt = new Date(timestamp ?? "");
  if (
    !id ||
    extra !== undefined ||
    Number.isNaN(createdAt.getTime()) ||
    createdAt.toISOString() !== timestamp
  )
    return null;
  return { createdAt, id };
}
