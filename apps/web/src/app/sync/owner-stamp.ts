/**
 * Who the browser's local database belongs to. Kept in localStorage so a boot
 * can read it before any network request. `user` is a copy of the last
 * session's user part, used to render before the session is confirmed; the
 * session token itself stays in the HttpOnly cookie.
 *
 * The stamp is written only after the first successful sync as that user and
 * removed before a wipe starts, so a wipe cut short by a page unload is
 * finished on the next boot (a boot without a stamp deletes the database).
 */
export const OWNER_STAMP_KEY = "morrow:owner-stamp";

export type OwnerStamp = {
  userId: string;
  user: { id: string } & Record<string, unknown>;
};

export function readOwnerStamp(): OwnerStamp | null {
  try {
    const stamp = JSON.parse(localStorage.getItem(OWNER_STAMP_KEY) ?? "null");
    return typeof stamp?.userId === "string" && typeof stamp.user === "object"
      ? stamp
      : null;
  } catch {
    return null;
  }
}

export function writeOwnerStamp(user: OwnerStamp["user"]) {
  try {
    localStorage.setItem(
      OWNER_STAMP_KEY,
      JSON.stringify({ userId: user.id, user } satisfies OwnerStamp),
    );
  } catch {
    // Storage full or blocked: the next boot starts from the network.
  }
}

export function removeOwnerStamp() {
  try {
    localStorage.removeItem(OWNER_STAMP_KEY);
  } catch {
    // Nothing to remove.
  }
}
