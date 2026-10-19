/**
 * Runs `task` once the browser is idle, so work that is not needed to paint
 * stays off the first render. Safari has no `requestIdleCallback`.
 */
export function whenIdle(task: () => void) {
  if ("requestIdleCallback" in window) {
    requestIdleCallback(task, { timeout: 5000 });
  } else {
    setTimeout(task, 2000);
  }
}
