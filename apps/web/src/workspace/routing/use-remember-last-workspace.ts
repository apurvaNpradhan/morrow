import { useEffect } from "react";
import { setActiveWorkspace } from "./lib/set-active-workspace";

type SessionLike = {
  session?: { activeOrganizationId?: string | null };
} | null;

/**
 * The session's active organization is only "last used": record the workspace
 * in the URL so `/` can reopen it. Skipped when the session is unknown, so a
 * dropped connection can't clobber the stored choice.
 */
export function useRememberLastWorkspace(
  workspaceId: string,
  session: SessionLike,
  sessionError: boolean,
) {
  const lastUsedId = session?.session?.activeOrganizationId;
  useEffect(() => {
    if (sessionError || !session || lastUsedId === workspaceId) return;
    void setActiveWorkspace(workspaceId);
  }, [workspaceId, lastUsedId, session, sessionError]);
}
