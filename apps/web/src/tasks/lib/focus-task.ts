import { currentView } from "./view-order-store";

/**
 * Brings a task on screen and focuses its card or row. The view only renders
 * what is in view, so the element may appear a frame or two after the scroll.
 */
export function focusTask(taskId: string) {
  currentView().reveal(taskId);
  let frames = 0;
  const focus = () => {
    const element = document.querySelector<HTMLElement>(
      `[data-task-id="${taskId}"]`,
    );
    if (element) element.focus();
    else if ((frames += 1) < 10) requestAnimationFrame(focus);
  };
  focus();
}
