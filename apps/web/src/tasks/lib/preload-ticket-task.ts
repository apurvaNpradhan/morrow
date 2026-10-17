import { projectCollection } from "@/projects";
import { ticketTask } from "../queries/task-queries";

/**
 * Starts loading the one task a full page shows, for the route loader: never
 * the rest of its Project. A Project that is not here loads nothing; the page
 * says so.
 */
export async function preloadTicketTask(
  workspaceId: string,
  projectKey: string,
  number: number,
) {
  await projectCollection.preload();
  const project = projectCollection.toArray.find(
    (candidate) =>
      candidate.workspaceId === workspaceId &&
      candidate.key === projectKey.toUpperCase(),
  );
  if (!project) return;
  await ticketTask(project.id, number).preload();
}
