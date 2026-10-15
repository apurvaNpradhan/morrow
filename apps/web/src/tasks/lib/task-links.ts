import { ticketId } from "@morrow/sync-schemas";

/** The address of a task, as shared: the workspace, then the ticket id. */
export function taskPath(slug: string, projectKey: string, number: number) {
  return `/${slug}/tasks/${ticketId(projectKey, number)}`;
}

export function taskUrl(slug: string, projectKey: string, number: number) {
  return `${window.location.origin}${taskPath(slug, projectKey, number)}`;
}

/** The ticket id as a task shows it; a task the server has not numbered yet shows an ellipsis. */
export function displayTicketId(projectKey: string, number: number) {
  return number > 0 ? ticketId(projectKey, number) : `${projectKey}-…`;
}

/** The focused task's id: a card or row, or something inside one. */
export function focusedTaskId() {
  const element = document.activeElement;
  return element instanceof Element
    ? (element.closest<HTMLElement>("[data-task-id]")?.dataset.taskId ?? null)
    : null;
}
