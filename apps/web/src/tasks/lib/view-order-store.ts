import type { TaskRow } from "@morrow/sync-schemas";

/**
 * What the open board or list publishes for the keyboard: the tasks it shows
 * in order, and a way to bring one on screen. The board and list only render
 * the cards and rows in view, so stepping works on this data, not the page.
 */
export type PublishedView = {
  /** Every task shown, in reading order: Columns in board order, each as sorted. */
  tasks: readonly TaskRow[];
  /** The board's lanes, each as its tasks top to bottom; null in the list. */
  lanes: readonly (readonly TaskRow[])[] | null;
  /** Scrolls the task into view, so that its card or row exists. */
  reveal: (taskId: string) => void;
};

const NOTHING: PublishedView = { tasks: [], lanes: null, reveal: () => {} };
let view = NOTHING;

export function publishView(next: PublishedView) {
  view = next;
}

export function clearView() {
  view = NOTHING;
}

export function currentView() {
  return view;
}

/** The task `delta` places after `taskId` in the view, or undefined at either end. */
export function neighborInView(taskId: string, delta: 1 | -1) {
  const index = view.tasks.findIndex((task) => task.id === taskId);
  return index === -1 ? undefined : view.tasks[index + delta];
}
