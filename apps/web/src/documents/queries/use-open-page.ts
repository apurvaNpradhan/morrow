import { useEffect, useState, useSyncExternalStore } from "react";
import {
  type OpenPage,
  type OpenPageOptions,
  openPage,
} from "../lib/open-page";

/** Opens the page for as long as the component is mounted; null for the first render. */
export function useOpenPage(options: OpenPageOptions): OpenPage | null {
  const [session, setSession] = useState<OpenPage | null>(null);
  const { workspaceId, userId, documentId, generation, canEdit } = options;
  useEffect(() => {
    const opened = openPage({
      workspaceId,
      userId,
      documentId,
      generation,
      canEdit,
    });
    setSession(opened);
    return () => {
      opened.destroy();
      setSession(null);
    };
  }, [workspaceId, userId, documentId, generation, canEdit]);
  return session;
}

/** The session's state, which changes when the page is ready or its session ends. */
export function usePageState(session: OpenPage) {
  return useSyncExternalStore(session.subscribe, session.getState);
}
