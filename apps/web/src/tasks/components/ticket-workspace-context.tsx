import { createContext, type ReactNode, useContext, useMemo } from "react";

export type TicketWorkspace = { id: string; slug: string };

const TicketWorkspaceContext = createContext<TicketWorkspace | null>(null);

/**
 * The Workspace whose ticket ids in a description or comment link to its tasks.
 * Mounted by the Workspace's route, so every editor under it knows the Workspace.
 */
export function TicketWorkspaceProvider({
  id,
  slug,
  children,
}: TicketWorkspace & { children: ReactNode }) {
  const value = useMemo(() => ({ id, slug }), [id, slug]);
  return (
    <TicketWorkspaceContext.Provider value={value}>
      {children}
    </TicketWorkspaceContext.Provider>
  );
}

/** The Workspace of the ticket ids, or null outside one: they stay plain text. */
export function useTicketWorkspace(): TicketWorkspace | null {
  return useContext(TicketWorkspaceContext);
}
